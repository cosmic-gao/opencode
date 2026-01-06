# @opencode/plugable

通用插件系统，基于 Pipeline + Middleware 模型设计。

## 安装

```bash
pnpm add @opencode/plugable
```

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                      Manager                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    Plugins                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │   │
│  │  │ Plugin1 │→ │ Plugin2 │→ │ Plugin3 │  (拓扑排序) │
│  │  └────┬────┘  └────┬────┘  └────┬────┘         │   │
│  └───────│───────────│───────────│─────────────────┘   │
│          ↓           ↓           ↓                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                     Hooks                        │   │
│  │  ┌────────┐ ┌─────────┐ ┌───────┐ ┌─────────┐  │   │
│  │  │SyncHook│ │AsyncHook│ │Waterfall│ │Collect │  │   │
│  │  └────────┘ └─────────┘ └───────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↓                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │                   Pipeline                       │   │
│  │  Input → [M1] → [M2] → [M3] → Output            │   │
│  │               ↑                                  │   │
│  │           Counter (index + next)                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 核心概念

### Pipeline

Pipeline 是中间件执行的核心抽象，基于 Counter 模式实现：

```typescript
import { createPipeline, createAsyncPipeline } from '@opencode/plugable'

// 同步 Pipeline
const pipe = createPipeline<string>()
pipe.use((value, next) => {
  console.log('before:', value)
  const result = next(value.toUpperCase())
  console.log('after:', result)
  return result
})
pipe.run('hello') // => 'HELLO'

// 异步 Pipeline
const asyncPipe = createAsyncPipeline<number>()
asyncPipe.use(async (value, next) => {
  await delay(100)
  return next(value * 2)
})
await asyncPipe.run(10) // => 20
```

### Counter

Counter 管理中间件索引链，提供 `dispatch` 和 `next` 函数：

```typescript
import { createCounter } from '@opencode/plugable'

const counter = createCounter((index, input, next) => {
  if (index >= middlewares.length) return input
  return middlewares[index](input, next)
})
counter.start(initialValue)
```

### Hook

7 种 Hook 类型满足不同场景，**所有执行类 Hook 都基于 Pipeline 实现**：

| Hook | 执行方式 | 返回值 | 基于 | 适用场景 |
|------|---------|--------|------|----------|
| SyncHook | 同步串行 | 最后值 | Pipeline | 简单转换 |
| AsyncHook | 异步串行 | Promise | AsyncPipeline | 异步转换 |
| Waterfall | 同步+next | 管道值 | Pipeline | 可控流程 |
| AsyncWaterfall | 异步+next | Promise | AsyncPipeline | 异步管道 |
| Collect | 同步收集 | 数组 | Pipeline | 收集结果 |
| AsyncCollect | 异步收集 | Promise | AsyncPipeline | 异步收集 |
| **APIHook** | API 注册 | 对象/undefined | - | **插件间 API 共享** |

```typescript
import { 
  createSyncHook, 
  createAsyncHook,
  createWaterfall,
  createAsyncWaterfall,
  createCollect,
  createAsyncCollect,
  createAPIHook
} from '@opencode/plugable'

// SyncHook - 基于 Pipeline，串行执行，每个回调可修改值
const hook = createSyncHook<string>()
hook.tap(value => value + '!')
hook.call('hello') // => 'hello!'

// Waterfall - 基于 Pipeline，支持 next() 控制流
const waterfall = createWaterfall<number>()
waterfall.tap((value, next) => {
  if (value < 0) return 0  // 短路
  return next(value + 1)   // 继续
})

// Collect - 基于 Pipeline，收集所有返回值
const collect = createCollect<string, number>()
collect.tap(s => s.length)
collect.tap(s => s.split(' ').length)
collect.call('hello world') // => [11, 2]

// APIHook - 插件间 API 共享 (独立于 Pipeline)
const apiHook = createAPIHook<WorkerFactory>()
apiHook.provide({ createWorker: () => new Worker() })  // 提供 API
const factory = apiHook.use() // 获取 API => WorkerFactory | undefined
apiHook.clear() // 清除已注册的 API
```

#### APIHook 详细说明

APIHook 用于插件间 API 共享，不同于执行类 Hook：

**特性**：
- **provide(api)**: 注册 API，只能调用一次
- **use()**: 获取已注册的 API，返回 `T | undefined`
- **clear()**: 清除已注册的 API
- **type**: 固定为 `'api'`

**使用场景**：
```typescript
// SandboxPlugin 提供 WorkerFactory API
const SandboxPlugin = {
  name: 'sandbox',
  registryHook: {
    onWorker: createAPIHook<WorkerFactory>()
  },
  setup: (api) => {
    const factory = { createWorker, createExecutor }
    ;(api.onWorker as APIHook<WorkerFactory>).provide(factory)
  }
}

// ClusterPlugin 使用 SandboxPlugin 提供的 API
const ClusterPlugin = {
  name: 'cluster',
  required: ['sandbox'],
  setup: (api) => {
    const factory = (api.onWorker as APIHook<WorkerFactory>).use()
    if (!factory) throw new Error('WorkerFactory not available')
    
    // 使用 factory API
    const worker = factory.createWorker()
  }
}
```

**注意事项**：
- APIHook 不是 Pipeline，没有 `tap()` 或 `call()` 方法
- `provide()` 只能调用一次，重复调用会抛出错误
- 需要类型断言：`(api.onWorker as APIHook<T>)`
- 建议在 `required` 中声明依赖，确保 API 已注册
```

### Plugin

插件结构定义：

```typescript
interface Plugin<H extends Hooks, C> {
  name: string           // 唯一标识
  pre?: string[]         // 在这些插件之前执行
  post?: string[]        // 在这些插件之后执行
  required?: string[]    // 依赖的插件
  usePlugins?: Plugin[]  // 内部使用的插件
  registryHook?: Hooks   // 注册新 Hook
  setup: (api: PluginAPI) => void | Promise<void>
}
```

插件示例：

```typescript
// 执行类 Hook 示例
const LogPlugin: Plugin<MyHooks, MyContext> = {
  name: 'log',
  post: ['core'],  // 在 core 之后执行
  setup: (api) => {
    api.onExecute.tap(async (ctx, next) => {
      console.log('start')
      const result = await next(ctx)
      console.log('end')
      return result
    })
  }
}

// APIHook 提供者示例
const ProviderPlugin: Plugin<MyHooks, MyContext> = {
  name: 'provider',
  registryHook: {
    onService: createAPIHook<Service>()
  },
  setup: (api) => {
    const service = createService()
    ;(api.onService as APIHook<Service>).provide(service)
  }
}

// APIHook 消费者示例
const ConsumerPlugin: Plugin<MyHooks, MyContext> = {
  name: 'consumer',
  required: ['provider'],  // 声明依赖
  setup: (api) => {
    const service = (api.onService as APIHook<Service>).use()
    if (!service) throw new Error('Service not available')
    service.doSomething()
  }
}
```

### Manager

插件管理器负责：
- 插件注册与去重
- 拓扑排序（Kahn 算法）
- 依赖检查
- Hook 合并
- 生命周期管理

```typescript
import { createManager } from '@opencode/plugable'

const manager = createManager({
  hooks: { onLoad: createAsyncHook() },
  context: { data: null }
})

manager.use(PluginA)
manager.use([PluginB, PluginC])

await manager.init({ data: 'initial' })

manager.getHooks().onLoad.call(value)
manager.getContext()  // => { data: 'initial' }
manager.exists('PluginA')  // => true
```

### Sort

拓扑排序确保插件按依赖顺序执行：

```typescript
// PluginA: { pre: ['PluginB'] }  => A 在 B 之前
// PluginB: { post: ['PluginC'] } => B 在 C 之后
// 执行顺序: A → C → B

// 循环依赖检测
// PluginA: { pre: ['PluginB'] }
// PluginB: { pre: ['PluginA'] }
// => PluginSortError: Circular: PluginA → PluginB
```

## API

### Pipeline

```typescript
createPipeline<I, O>(): Pipeline<I, O>
createAsyncPipeline<I, O>(): AsyncPipeline<I, O>
createCounter<I, O>(fn: CounterFn<I, O>): Counter<I, O>
```

### Hook

```typescript
createSyncHook<T>(): SyncHook<T>
createAsyncHook<T>(): AsyncHook<T>
createWaterfall<T>(): Waterfall<T>
createAsyncWaterfall<T>(): AsyncWaterfall<T>
createCollect<T, R>(): Collect<T, R>
createAsyncCollect<T, R>(): AsyncCollect<T, R>
createAPIHook<T>(): APIHook<T>
```

### Manager

```typescript
createManager<H, C>(options: ManagerOptions<H, C>): Manager<H, C>

interface Manager<H, C> {
  use: (plugin: Plugin | Plugin[]) => Manager
  init: (context?: Partial<C>) => Promise<void>
  getHooks: () => H
  getContext: () => C
  setContext: (partial: Partial<C>) => void
  exists: (name: string) => boolean
  getPlugin: (name: string) => Plugin | undefined
  getNames: () => string[]
}
```

### Sort

```typescript
sort<H, C>(plugins: Plugin<H, C>[]): SortResult<H, C>

class PluginSortError extends Error {
  readonly kind: 'cycle' | 'missing'
  readonly plugins?: string[]
}
```

## 设计原则

1. **统一 Pipeline 架构** - 所有 Hook 都基于 Pipeline/AsyncPipeline 实现
2. **Counter 抽象** - 索引管理与递归调用解耦
3. **中间件控制流** - 通过 `next()` 控制执行流程
4. **拓扑排序** - Kahn 算法保证插件依赖顺序
5. **简洁 API** - Hooks 直接暴露在 PluginAPI 上（`api.onExecute` 而非 `api.hooks.onExecute`）
6. **类型安全** - 完整的 TypeScript 泛型支持
7. **零依赖** - 无运行时依赖
