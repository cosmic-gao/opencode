# Isolate - 安全沙箱代码执行引擎

> 基于 Deno Worker 的隔离式 JavaScript/TypeScript 代码执行服务，支持插件化扩展和细粒度权限控制

## 📋 目录

- [项目概述](#项目概述)
- [快速开始](#快速开始)
- [架构设计](#架构设计)
- [核心模块](#核心模块)
- [插件系统](#插件系统)
- [工具系统](#工具系统)
- [权限管理](#权限管理)
- [API 接口](#api-接口)
- [使用场景](#使用场景)
- [配置说明](#配置说明)
- [最佳实践](#最佳实践)

---

## 项目概述

### 简介

Isolate 是一个基于 Deno 运行时的安全沙箱代码执行引擎。它允许在隔离的环境中安全执行用户提供的 JavaScript/TypeScript 代码，具有以下核心特性：

- **微内核架构**：核心功能精简，通过插件系统扩展能力
- **模块化设计**：按职责拆分为独立模块，易于维护和测试
- **插件化系统**：基于 `@opencode/plugable` 通用插件系统，支持 Hook 扩展
- **细粒度权限**：动态权限聚合，工具级权限隔离，支持严格模式验证
- **安全隔离**：使用 Deno Worker 权限系统，完全隔离代码执行环境
- **超时控制**：支持可配置的执行超时，防止无限循环或长时间运行
- **日志捕获**：自动捕获 `console.log/info/warn/error` 输出
- **HTTP 服务**：提供 RESTful API 接口，便于集成

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Deno | 最新稳定版 | 运行时环境 |
| Hono | 4.4.11 | HTTP 框架 |
| TypeScript | ESNext | 开发语言 |
| @opencode/plugable | workspace | 插件系统 |

---

## 快速开始

### 安装依赖

```bash
# 使用 Deno
deno cache src/server.ts

# 或使用 pnpm（在 monorepo 中）
pnpm install
```

### 启动服务

```bash
# 开发模式（带热重载）
deno task dev

# 生产模式
deno run --allow-net --allow-read=./src src/server.ts
```

### 基础示例

**简单计算**：
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default (x) => x * 2",
    "input": 21
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": 42,
  "duration": 2
}
```

### 工具使用示例

#### 示例 1: crypto 工具 - 生成随机数和 UUID

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default function() { const uuid = crypto.randomUUID(); const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return { uuid, bytes: Array.from(bytes) }; }",
    "tools": ["crypto"]
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "bytes": [123, 45, 67, 89, ...]
  },
  "duration": 3
}
```

#### 示例 2: crypto 工具 - 数据哈希

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async function(text) { const encoder = new TextEncoder(); const data = encoder.encode(text); const hash = await crypto.subtle.digest(\"SHA-256\", data); return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, \"0\")).join(\"\"); }",
    "input": "Hello, World!",
    "tools": ["crypto"]
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
  "duration": 5
}
```

#### 示例 3: channel 工具 - 消息通信

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default function(message) { console.log(\"Sending message:\", message); channel.emit(\"notification\", { type: \"info\", text: message, timestamp: Date.now() }); return \"Message sent successfully\"; }",
    "input": "Task completed",
    "tools": ["channel"]
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": "Message sent successfully",
  "logs": [
    {
      "level": "log",
      "message": "Sending message: Task completed",
      "timestamp": 1704614400000
    }
  ],
  "duration": 2
}
```

#### 示例 4: database 工具 - 查询数据

```bash
# 需要先设置环境变量: export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async function() { const users = await db.users.select().limit(10); return { total: users.length, users: users.map(u => ({ id: u.id, name: u.name })) }; }",
    "tools": ["db"]
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": {
    "total": 5,
    "users": [
      { "id": 1, "name": "Alice" },
      { "id": 2, "name": "Bob" }
    ]
  },
  "duration": 45
}
```

#### 示例 5: 多工具组合使用

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async function(userId) { const users = await db.users.select().limit(1); const user = users[0]; const sessionId = crypto.randomUUID(); channel.emit(\"user:login\", { userId, sessionId, timestamp: Date.now() }); return { user: user?.name, sessionId }; }",
    "input": 123,
    "tools": ["crypto", "channel", "db"]
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": {
    "user": "Alice",
    "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "duration": 38
}
```

#### 示例 6: 自定义权限控制

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async function(url) { const response = await fetch(url); const data = await response.json(); return data; }",
    "input": "https://api.github.com/repos/denoland/deno",
    "permissions": {
      "net": ["api.github.com"]
    }
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": {
    "name": "deno",
    "stargazers_count": 95000,
    "language": "Rust"
  },
  "duration": 234
}
```

#### 示例 7: 错误处理

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default function(x) { if (!x) throw new Error(\"Input is required\"); return x * 2; }",
    "input": null
  }'
```

**响应**：
```json
{
  "ok": false,
  "logs": [
    {
      "level": "exception",
      "message": "Input is required",
      "name": "Error",
      "stack": "Error: Input is required\n    at default (data:...)",
      "timestamp": 1704614400000
    }
  ],
  "duration": 1
}
```

#### 示例 8: 超时控制

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default function() { while(true) {} }",
    "timeout": 1000
  }'
```

**响应**：
```json
{
  "ok": false,
  "logs": [
    {
      "level": "exception",
      "message": "Execution timeout",
      "name": "TimeoutError",
      "timestamp": 1704614400000
    }
  ],
  "duration": 1001
}
```

#### 示例 9: 异步数据处理

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async function(items) { const results = await Promise.all(items.map(async (item) => { await new Promise(r => setTimeout(r, 10)); return item.toUpperCase(); })); return results; }",
    "input": ["hello", "world", "deno"],
    "timeout": 5000
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": ["HELLO", "WORLD", "DENO"],
  "duration": 45
}
```

#### 示例 10: 日志调试

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default function(data) { console.log(\"Processing data:\", data); const result = data.map(x => x * 2); console.log(\"Result:\", result); return result; }",
    "input": [1, 2, 3, 4, 5]
  }'
```

**响应**：
```json
{
  "ok": true,
  "result": [2, 4, 6, 8, 10],
  "logs": [
    {
      "level": "log",
      "message": "Processing data: [1,2,3,4,5]",
      "timestamp": 1704614400000
    },
    {
      "level": "log",
      "message": "Result: [2,4,6,8,10]",
      "timestamp": 1704614400001
    }
  ],
  "duration": 3
}
```

### Node.js/TypeScript 客户端示例

```typescript
// client.ts
interface ExecuteRequest {
  code: string;
  input?: unknown;
  entry?: string;
  timeout?: number;
  tools?: string[];
  permissions?: Record<string, unknown>;
}

interface ExecuteResponse {
  ok: boolean;
  result?: unknown;
  logs?: Array<{
    level: string;
    message: string;
    timestamp: number;
  }>;
  duration: number;
}

async function execute(request: ExecuteRequest): Promise<ExecuteResponse> {
  const response = await fetch('http://localhost:8787/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// 使用示例
const result = await execute({
  code: `
    export default async function(userId) {
      const user = await db.users.findUnique({ where: { id: userId } });
      return { id: user.id, name: user.name };
    }
  `,
  input: 123,
  tools: ['database'],
  timeout: 5000
});

console.log('Result:', result.result);
console.log('Duration:', result.duration, 'ms');
```

### Python 客户端示例

```python
# client.py
import requests
import json

def execute(code: str, input_data=None, tools=None, timeout=3000):
    payload = {
        'code': code,
        'input': input_data,
        'tools': tools or [],
        'timeout': timeout
    }
    
    response = requests.post(
        'http://localhost:8787/execute',
        headers={'Content-Type': 'application/json'},
        json=payload
    )
    
    response.raise_for_status()
    return response.json()

# 使用示例
result = execute(
    code='''
        export default function(numbers) {
            return numbers.reduce((sum, n) => sum + n, 0);
        }
    ''',
    input_data=[1, 2, 3, 4, 5]
)

print(f"Result: {result['result']}")
print(f"Duration: {result['duration']}ms")
```

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        HTTP Client                          │
└─────────────────────────────┬───────────────────────────────┘
                              │ POST /execute
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Server (server.ts)                     │
│                    Hono HTTP Framework                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Kernel (kernel.ts)                     │
│                  执行入口 & 插件管理器                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │   Plugin Pipeline     │
                  ├───────────────────────┤
                  │ 1. GuardPlugin        │ 请求验证
                  │ 2. ToolsetPlugin      │ 工具管理
                  │ 3. LoaderPlugin       │ 代码加载
                  │ 4. PermissionPlugin   │ 权限聚合
                  │ 5. SandboxPlugin      │ 执行环境
                  │ 6. ChannelPlugin      │ 通信通道
                  │ 7. ClusterPlugin*     │ Worker 池
                  │ 8. LoggerPlugin       │ 日志处理
                  └───────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker (worker.ts)                      │
│              隔离执行环境 (动态权限控制)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 工具注入      │  │  日志拦截     │  │  代码执行        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 模块化架构

```
src/
├─ common/              # 通用工具模块
│  ├─ proxy.ts         # 代理封装（白名单、验证器）
│  ├─ lazy.ts          # 延迟加载工厂
│  ├─ inject.ts        # 全局注入和清理
│  ├─ tools.ts         # 工具管理（注册、安装、引导）
│  └─ utils.ts         # 辅助函数（错误、序列化）
│
├─ permissions/         # 权限管理模块
│  ├─ merger.ts        # 权限合并算法
│  ├─ parser.ts        # URL 解析（数据库主机）
│  ├─ detector.ts      # 安全检测（通配符、主机数量）
│  ├─ validator.ts     # 严格模式验证
│  └─ normalizer.ts    # 权限规范化
│
├─ plugins/             # 插件系统
│  ├─ guard.ts         # 请求验证
│  ├─ toolset.ts       # 工具集管理
│  ├─ loader.ts        # 代码加载
│  ├─ permission.ts    # 权限聚合
│  ├─ sandbox.ts       # 执行环境（编排层）
│  ├─ channel.ts       # 消息通道
│  ├─ cluster.ts       # Worker 池
│  ├─ logger.ts        # 日志过滤
│  └─ sandbox/         # Sandbox 内部模块
│     ├─ spawn.ts      # Worker 创建
│     ├─ executor.ts   # 执行逻辑
│     └─ timeout.ts    # 超时控制
│
├─ tools/               # 工具实现
│  ├─ crypto.ts        # 加密工具
│  ├─ channel.ts       # 通信工具
│  └─ db.ts            # 数据库工具
│
├─ types.ts             # 类型定义
├─ config.ts            # 配置管理
├─ kernel.ts            # 内核（插件编排）
├─ worker.ts            # Worker 入口
├─ bridge.ts            # 通信桥接
└─ server.ts            # HTTP 服务
```

### 数据流

```
Request 
  ↓ GuardPlugin: 验证 code、提取 tools/permissions
  ↓ ToolsetPlugin: 验证工具名称 → ctx.tools
  ↓ LoaderPlugin: 编码代码为 data URL → ctx.url
  ↓ PermissionPlugin: 聚合工具权限 → ctx.permissions
  ↓ SandboxPlugin: 创建 Worker(ctx.permissions)
  ↓   └─ spawn: new Worker(url, { permissions })
  ↓   └─ executor: postMessage(packet)
  ↓   └─ timeout: Promise.race([result, timeoutError])
  ↓ Worker: bootstrap(tools) → 执行用户代码
  ↓ ChannelPlugin: 转发消息（如有）
  ↓ LoggerPlugin: 过滤日志
  ↓ Output
```

---

## 核心模块

### 1. 通用工具 (common/)

#### proxy.ts - 安全代理
```typescript
import { proxy } from './common/proxy.ts'

// 白名单代理
const safe = proxy(crypto, {
  whitelist: ['getRandomValues', 'randomUUID'],
  validator: (prop, args) => {
    if (prop === 'getRandomValues' && args[0].byteLength > 65536) {
      throw new Error('Array too large')
    }
  }
})
```

#### lazy.ts - 延迟加载
```typescript
import { lazy } from './common/lazy.ts'

const db = lazy(() => Database.create())
// 使用时才初始化
await db.users.findMany()
```

#### inject.ts - 全局注入
```typescript
import { inject, provide, reset } from './common/inject.ts'

// 注入不可变全局变量
inject(globalThis, 'API_KEY', 'secret')

// 批量注入
provide(globalThis, { foo: 1, bar: 2 })

// 清理注入的变量
reset(globalThis, ['crypto'])  // 保留 crypto，清理其他
```

### 2. 权限管理 (permissions/)

#### merger.ts - 权限合并
```typescript
import { merge } from './permissions/merger.ts'

const base = { env: ['A'], net: ['host1'] }
const extra = { env: ['B'], net: ['host2'] }
const result = merge(base, extra)
// { env: ['A', 'B'], net: ['host1', 'host2'] }
```

#### parser.ts - URL 解析
```typescript
import { parse } from './permissions/parser.ts'

const host = parse('postgres://user@localhost:5432/db')
// 'localhost:5432'
```

#### detector.ts - 安全检测
```typescript
import { detect } from './permissions/detector.ts'

const info = detect({ net: ['*', 'localhost'] })
// { wild: true, hosts: 2, local: true }
```

#### validator.ts - 严格验证
```typescript
import { validate } from './permissions/validator.ts'

validate(permissions, true)  // strict = true
// 输出警告: [Strict] Wildcard permission detected
```

---

## 插件系统

### 插件架构

基于 `@opencode/plugable` 的 Hook 系统，每个插件通过钩子进行通信：

```typescript
interface IsolateHooks {
  onValidate: AsyncHook<Request>   // 验证请求
  onLoad: AsyncHook<Context>        // 加载上下文
  onSpawn: SyncHook<Process>        // Worker 创建后
  onExecute: AsyncHook<Context>     // 执行代码
  onFormat: AsyncHook<Output>       // 格式化输出
}
```

### 插件列表

| 插件 | 职责 | 依赖 |
|------|------|------|
| **GuardPlugin** | 请求验证和字段提取 | - |
| **ToolsetPlugin** | 工具注册和验证 | guard |
| **LoaderPlugin** | 代码编码为 data URL | guard |
| **PermissionPlugin** | 权限聚合和验证 | guard, toolset |
| **SandboxPlugin** | Worker 执行环境 | guard, loader |
| **ChannelPlugin** | 消息通道管理 | sandbox |
| **ClusterPlugin** | Worker 池管理（可选） | guard, loader, sandbox |
| **LoggerPlugin** | 日志过滤和格式化 | - |

### 插件示例

**自定义插件**：
```typescript
import type { IsolatePlugin } from './types.ts'

export const CustomPlugin: IsolatePlugin = {
  name: 'custom',
  required: ['guard'],
  setup(api) {
    api.onValidate.tap(async (request) => {
      console.log('Validating:', request.code.length)
      return request
    })
  }
}

// 使用
const isolate = await create({
  plugins: [CustomPlugin]
})
```

---

## 工具系统

### 工具架构

工具是注入到 Worker 全局作用域的受控 API，提供安全的外部能力访问。

#### 工具定义

```typescript
interface Tool {
  name: string;                                    // 工具名称
  permissions?: Perms | ((ctx: Context) => Perms); // 所需权限
  config?: unknown;                                 // 配置选项
  setup: (globals: Record<string, unknown>) => void | Promise<void>;
}

type Perms = "none" | {
  env?: string[];
  net?: string[];
  read?: string[];
  write?: string[];
  run?: string[];
  ffi?: string[];
  hrtime?: boolean;
};
```

### 内置工具

#### 1. crypto - 加密工具

**权限**: `"none"`  
**API**:
- `crypto.getRandomValues(array)` - 生成随机数
- `crypto.randomUUID()` - 生成 UUID
- `crypto.subtle` - Web Crypto API（可选）

**配置**:
```typescript
{
  crypto: {
    subtle: true,              // 启用 subtle API
    limit: 65536,              // 最大字节数
    methods: ['getRandomValues', 'randomUUID']  // 白名单
  }
}
```

**使用示例**:
```javascript
export default function() {
  const uuid = crypto.randomUUID();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return { uuid, random: Array.from(bytes) };
}
```

**安全限制**:
- 操作计数限制（默认 1000 次）
- 数组大小限制（默认 65536 字节）
- 仅白名单方法可访问

#### 2. channel - 通信工具

**权限**: `"none"`  
**API**:
- `channel.emit(topic, data)` - 发送消息
- `channel.on(topic, handler)` - 订阅消息
- `channel.off(topic, handler)` - 取消订阅

**使用示例**:
```javascript
export default function() {
  // 发送消息到 Host
  channel.emit('log', 'Hello from worker');
  
  // 监听来自其他 Worker 的消息
  channel.on('greeting', (data) => {
    console.log('Received:', data);
  });
  
  return 'Message sent';
}
```

**特性**:
- 基于 `postMessage` 的安全通信
- 消息队列（最多 100 条）
- 微任务调度，避免阻塞

#### 3. database - 数据库工具

**权限**: 动态计算
```typescript
{
  env: ["DATABASE_URL"],
  net: ["parsed-host:5432"]  // 从 DATABASE_URL 解析
}
```

**API**:
- Drizzle ORM 完整 API
- 自动加载 `src/schemas/` 下的表定义

**配置**:
```typescript
{
  db: {
    hosts: ['backup.db.example.com:5432']  // 额外允许的主机
  }
}
```

**使用示例**:
```javascript
export default async function() {
  // 访问 users 表（需要在 schemas/users.ts 定义）
  const users = await db.users.findMany({
    where: { active: true },
    limit: 10
  });
  return users.length;
}
```

**安全特性**:
- 延迟加载（使用时才连接）
- 主机名白名单（拒绝 `*` 通配符）
- 自动权限解析（从 DATABASE_URL）

### 工具配置化

工具支持运行时配置，允许用户自定义权限和行为：

```typescript
import { create } from './kernel.ts';
import { config } from './config.ts';

const isolate = await create({
  config: config({
    crypto: {
      subtle: false,           // 禁用 subtle API
      limit: 1024,             // 限制为 1KB
    }
  })
});
```

### 自定义工具

**创建工具**:
```typescript
import type { Tool } from './types.ts';
import { inject, proxy } from './common/index.ts';

export function http(): Tool {
  return {
    name: 'http',
    permissions: {
      net: ['api.example.com']
    },
    setup: (globals) => {
      const api = {
        get: async (path: string) => {
          const res = await fetch(`https://api.example.com${path}`);
          return res.json();
        }
      };
      Object.freeze(api);
      inject(globals, 'http', api);
    }
  };
}
```

**注册工具**:
```typescript
// tools/index.ts
import { http } from './http.ts';

export function build(config?: Config): Tool[] {
  return [
    crypto(config?.crypto),
    channel,
    db(),
    http(),  // 新增工具
  ];
}
```

---

## 权限管理

### 权限系统架构

Isolate 实现了细粒度的权限控制系统，确保最小权限原则。

#### 权限流程

```
用户请求 {tools: ["database"], permissions: {...}}
  ↓
1. GuardPlugin: 提取 tools 和 permissions 字段
  ↓
2. ToolsetPlugin: 验证工具名称有效性
  ↓
3. PermissionPlugin:
   ├─ 从工具提取权限（database.permissions()）
   ├─ 合并用户权限（merge(user, tool)）
   ├─ 验证安全性（strict 模式）
   └─ 规范化（normalize）
  ↓
4. SandboxPlugin: 创建 Worker(ctx.permissions)
  ↓
5. Worker: 仅具备聚合后的最小权限
```

### 权限类型

```typescript
type Perms = "none" | {
  env?: string[];      // 环境变量白名单
  net?: string[];      // 网络主机白名单
  read?: string[];     // 文件读取路径白名单
  write?: string[];    // 文件写入路径白名单
  run?: string[];      // 命令执行白名单
  ffi?: string[];      // FFI 库白名单
  hrtime?: boolean;    // 高精度时间
};
```

### 权限合并算法

**规则**:
1. `"none"` + 任意 = 任意
2. 数组字段：去重合并
3. 布尔字段：覆盖
4. 禁止 `"inherit"`（抛出错误）

**示例**:
```typescript
const user = { env: ['A'], net: ['host1'] };
const tool = { env: ['B'], net: ['host2'] };
const result = merge(user, tool);
// { env: ['A', 'B'], net: ['host1', 'host2'] }
```

### 严格模式

启用严格模式后，系统会检测潜在的安全问题：

```typescript
const isolate = await create({
  config: { strict: true }
});
```

**检测项**:
- ⚠️ 通配符权限（`net: ["*"]`）
- ⚠️ 过多主机（`net` 数量 > 10）
- ⚠️ 本地主机访问（`127.0.0.1`, `localhost`）

**输出示例**:
```
[Strict] Wildcard permission detected
[Strict] Too many hosts: 15
[Strict] Local host access detected
```

### 审计模式

启用审计模式记录所有权限使用：

```typescript
const isolate = await create({
  config: { audit: true }
});
```

**输出示例**:
```json
[Audit] {
  "tools": ["database", "crypto"],
  "permissions": {
    "env": ["DATABASE_URL"],
    "net": ["db.example.com:5432"]
  },
  "duration": 45
}
```

### 动态权限解析

工具可以根据上下文动态计算权限：

```typescript
export function db(): Tool {
  return {
    name: 'database',
    permissions: () => {
      const url = Deno.env.get('DATABASE_URL') || '';
      const host = parse(url);  // 解析实际主机名
      return {
        env: ["DATABASE_URL"],
        net: [host]  // 精确指定，拒绝通配符
      };
    },
    setup: (globals) => {
      // ...
    }
  };
}
```

### 安全最佳实践

1. **最小权限原则**
   ```typescript
   // ❌ 不推荐：通配符
   permissions: { net: ["*"] }
   
   // ✅ 推荐：精确主机
   permissions: { net: ["api.example.com"] }
   ```

2. **动态权限**
   ```typescript
   // ✅ 从配置解析实际主机
   permissions: (ctx) => ({
     net: [parseHost(ctx.config.DATABASE_URL)]
   })
   ```

3. **启用严格模式**
   ```typescript
   const isolate = await create({
     config: { strict: true, audit: true }
   });
   ```

---

## API 接口

### HTTP API

#### POST /execute

执行用户代码并返回结果。

**请求**:
```json
{
  "code": "export default (x) => x * 2",
  "input": 21,
  "entry": "default",
  "timeout": 5000,
  "tools": ["crypto"],
  "permissions": {
    "net": ["api.example.com"]
  }
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `code` | string | ✅ | - | 用户代码（ES Module） |
| `input` | unknown | ❌ | undefined | 传递给入口函数的参数 |
| `entry` | string | ❌ | "default" | 入口函数名 |
| `timeout` | number | ❌ | 3000 | 超时时间（毫秒） |
| `tools` | string[] | ❌ | [] | 请求的工具列表 |
| `permissions` | object | ❌ | {} | 用户额外权限 |

**响应（成功）**:
```json
{
  "ok": true,
  "result": 42,
  "logs": [
    {
      "level": "log",
      "message": "Processing...",
      "timestamp": 1704614400000
    }
  ],
  "duration": 12
}
```

**响应（失败）**:
```json
{
  "ok": false,
  "logs": [
    {
      "level": "exception",
      "message": "x is not defined",
      "name": "ReferenceError",
      "stack": "...",
      "timestamp": 1704614400000
    }
  ],
  "duration": 5
}
```

### 编程 API

```typescript
import { create } from './kernel.ts';
import { config } from './config.ts';

// 创建实例
const isolate = await create({
  config: config({
    maxSize: 100_000,
    timeout: 3_000,
    port: 8787,
    strict: true,
    audit: false,
  }),
  useCluster: true,
  plugins: []  // 自定义插件
});

// 执行代码
const output = await isolate.execute({
  code: 'export default (x) => x * 2',
  input: 21,
  tools: ['crypto']
});

console.log(output);
// { ok: true, result: 42, duration: 2 }
```

---

## 配置说明

### Config 接口

```typescript
interface Config {
  maxSize: number;      // 最大代码大小（字节）
  timeout: number;      // 默认超时（毫秒）
  port: number;         // HTTP 服务端口
  strict?: boolean;     // 严格模式（权限验证）
  audit?: boolean;      // 审计模式（记录日志）
  crypto?: {            // crypto 工具配置
    subtle?: boolean;
    limit?: number;
    methods?: string[];
  };
}
```

### 默认配置

```typescript
const DEFAULT_CONFIG: Config = {
  maxSize: 100_000,     // 100KB
  timeout: 3_000,       // 3秒
  port: 8787,
  strict: false,
  audit: false,
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | HTTP 服务端口 | 8787 |
| `DATABASE_URL` | 数据库连接字符串 | - |
| `STRICT_MODE` | 严格模式 | false |

---

## 使用场景

### 1. 在线代码编辑器

```typescript
// 前端代码
const response = await fetch('/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: editor.getValue(),
    input: { userId: 123 }
  })
});

const result = await response.json();
console.log('Output:', result.result);
console.log('Logs:', result.logs);
```

### 2. Serverless 函数

```typescript
// 存储在数据库的函数
const func = {
  id: 'validate-email',
  code: `
    export default function(email) {
      const regex = /^[^@]+@[^@]+\\.[^@]+$/;
      return regex.test(email);
    }
  `
};

// 动态执行
const output = await isolate.execute({
  code: func.code,
  input: 'user@example.com'
});
```

### 3. 用户脚本运行时

```typescript
// 用户上传的数据处理脚本
const userScript = `
  export default function(data) {
    return data
      .filter(item => item.active)
      .map(item => ({
        id: item.id,
        name: item.name.toUpperCase()
      }));
  }
`;

const output = await isolate.execute({
  code: userScript,
  input: rawData,
  timeout: 10000
});
```

### 4. 插件系统

```typescript
// 应用插件钩子
const plugin = `
  export default function(event) {
    channel.emit('processed', {
      ...event,
      processedAt: Date.now()
    });
    return event;
  }
`;

const output = await isolate.execute({
  code: plugin,
  input: { type: 'user.login', userId: 123 },
  tools: ['channel']
});
```

---

## 最佳实践

### 1. 代码规范

**✅ 推荐**:
```typescript
// 使用 ES Module 导出
export default function(input) {
  return input * 2;
}

// 或命名导出
export function process(data) {
  return data.toUpperCase();
}
```

**❌ 避免**:
```javascript
// 不要使用 CommonJS
module.exports = function(input) {
  return input * 2;
}
```

### 2. 错误处理

**✅ 推荐**:
```typescript
export default function(input) {
  try {
    if (!input) throw new Error('Input required');
    return processInput(input);
  } catch (error) {
    console.error('Processing failed:', error.message);
    return null;
  }
}
```

### 3. 异步操作

**✅ 推荐**:
```typescript
export default async function(userId) {
  const user = await db.users.findUnique({
    where: { id: userId }
  });
  return user;
}
```

### 4. 工具使用

**✅ 推荐**:
```typescript
// 请求时声明需要的工具
{
  "code": "export default () => crypto.randomUUID()",
  "tools": ["crypto"]
}
```

**❌ 避免**:
```typescript
// 不声明工具会导致 undefined
{
  "code": "export default () => crypto.randomUUID()",
  "tools": []  // crypto 将不可用
}
```

### 5. 性能优化

**✅ 推荐**:
```typescript
// 使用 Cluster 模式（默认启用）
const isolate = await create({
  useCluster: true  // Worker 池复用
});

// 合理设置超时
{
  "timeout": 5000  // 避免过长或过短
}
```

---

## 技术细节

### Worker 隔离机制

```typescript
// Worker 创建时的权限设置
const worker = new Worker(url, {
  type: 'module',
  deno: {
    permissions: ctx.permissions  // 动态计算的权限
  }
});
```

### 日志拦截实现

```typescript
// worker.ts
function capture(level: Level) {
  return (...args: unknown[]) => {
    const entry: Entry = {
      level,
      message: args.map(stringify).join(' '),
      timestamp: Date.now()
    };
    self.postMessage({ type: 'log', data: entry });
  };
}

console.log = capture('log');
console.error = capture('error');
```

### 超时控制

```typescript
// sandbox/timeout.ts
const ctrl = timeout(limit, start);

const result = Promise.race([
  wait(worker, ctrl.abort.signal),  // 正常执行
  ctrl.promise                       // 超时 Promise
]);

// 超时时中断
ctrl.abort.abort();
proc.kill();
```

---

## 常见问题

### Q: 为什么我的代码无法访问 `fetch`？

A: 需要在请求中提供相应的权限：
```json
{
  "permissions": {
    "net": ["api.example.com"]
  }
}
```

### Q: 如何调试用户代码？

A: 查看响应中的 `logs` 字段：
```json
{
  "logs": [
    {"level": "log", "message": "Debug info"},
    {"level": "error", "message": "Error details"}
  ]
}
```

### Q: Worker 池如何工作？

A: ClusterPlugin 维护 2-8 个 Worker 实例，自动调度和回收：
```
最小: 2 个
最大: 8 个
空闲超时: 120 秒
健康检查: 30 秒
```

### Q: 如何添加自定义工具？

A: 参考[自定义工具](#自定义工具)章节，在 `tools/` 目录创建工具文件并注册。

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境

```bash
# 安装依赖
pnpm install

# 运行测试
deno test

# 启动开发服务器
deno task dev
```

### 项目结构
}
```

### 2. guard.ts - 请求验证器

负责验证和规范化输入请求：

| 验证项 | 规则 | 默认值 |
|--------|------|--------|
| `code` | 必须为字符串，长度 ≤ 100,000 字符 | - |
| `input` | 可选，任意类型 | `undefined` |
| `entry` | 可选，字符串 | `"default"` |
| `timeout` | 可选，数字 | `3000` ms |

**错误类型**：
- `Error("bad")` - 无效请求格式
- `PayloadTooLarge` - 代码超过大小限制

### 3. kernel.ts - 微内核架构

系统的核心协调器，采用 `@opencode/plugable` 构建的 `Manager` 模式驱动。

**初始化流程**:

1.  **加载配置**: 合并用户配置与默认配置。
2.  **创建 Manager**: 实例化 `AsyncParallelHook` 管理器。
3.  **注册插件**: 使用 `manager.use()` 加载内置插件 (Guard -> Toolset -> Loader -> Channel -> Cluster --> Logger)。
4.  **构建 API**: 通过 `syncHook` 暴露核心 API (如 `spawn`, `toolset`)。

```typescript
// 核心初始化逻辑
export async function createIsolate(options: Options = {}) {
  // ... 配置合并 ...
  
  const manager = new Manager<Context>(/* ... */);
  
  // 注册默认插件链
  manager.use([
    GuardPlugin,    // 1. 验证
    ToolsetPlugin,  // 2. 工具注入
    LoaderPlugin,   // 3. 代码加载
    SandboxPlugin,  // 4. 沙箱环境 (作为基础)
    ChannelPlugin,  // 5. 通信总线
    ClusterPlugin,  // 6. 进程池管理 (依赖 Sandbox API)
    LoggerPlugin,   // 7. 日志处理
  ]);

  // ...
  return { execute: /* ... */ }
}
```

### 4. sandbox.ts - 沙箱执行原理

**沙箱隔离机制**:

Isolate 的安全性不仅仅依赖于 Deno 的权限位，还包括运行时的上下文隔离。

*   **Global Inject (安全注入)**: 利用 `Object.defineProperty` 将工具注入到 Worker 全局作用域 (`configurable: false`, `writable: false`)，防止用户代码修改。
*   **Proxy Protection**: (可选) 对敏感对象使用 `Proxy` 进行访问控制。
*   **Error Normalization**: 使用 `errorish` 库将 Worker 内的所有异常（包括非标准 `throw`）标准化为序列化的 `Fault` 对象。

**执行生命周期**:

```mermaid
sequenceDiagram
    Kernel->>Sandbox: execute(request)
    Sandbox->>ToolChain: bootstrap(tools)
    ToolChain->>Global: inject(api)
    Sandbox->>Worker: postMessage(packet)
    Worker->>DynamicImport: import(dataUrl)
    DynamicImport->>UserCode: entry(input)
    UserCode-->>Worker: result
    Worker-->>Sandbox: postMessage(output)
```

### 5. worker.ts - Worker 运行时
5. 终止 Worker
6. 返回结果
```

### 5. worker.ts - Worker 执行器

在隔离环境中实际执行代码：

**功能特性**：

| 功能 | 说明 |
|------|------|
| 动态模块导入 | 通过 Data URL 导入用户代码 |
| 日志捕获 | 拦截 console 方法，收集输出 |
| 入口函数调用 | 调用指定的导出函数 |
| 错误处理 | 捕获并格式化执行错误 |

**日志拦截机制**：

```typescript
// 保存原始 console 方法
const base = { log: console.log.bind(console), ... }

// 替换为拦截版本
console.log = (...a) => { 
  store.push(格式化(a))  // 存储日志
  base.log(...a)         // 调用原始方法
}
```

### 6. channel.ts - 通信总线原理

采用 **Host-Mediated Star Topology** (宿主中介星型拓扑) 架构。

1.  **Event Listen**: Worker 内部通过 `channel.emit` 发送消息 (`postMessage`)。
2.  **Host Router**: `ChannelPlugin` 在宿主端监听所有 Worker 的 message 事件。
3.  **Broadcast**: 宿主识别 `type: 'channel'` 消息，并根据 `topic` 查找订阅者，或者直接广播给同一 Cluster 中的其他 Worker。

**路由逻辑 (ChannelPlugin)**:

```typescript
// 伪代码演示
worker.onmessage = (event) => {
  if (event.data.type === 'channel') {
    // 广播给其他 Process
    cluster.forEach(otherWorker => {
      if (otherWorker !== worker) {
        otherWorker.postMessage(event.data);
      }
    });
  }
}
```

### 7. loader.ts - 代码加载器

将代码字符串转换为可导入的 Data URL：

```typescript
function encode(code: string): string {
  const base = btoa(code)
  return `data:application/javascript;base64,${base}`
}
```

### 8. bridge.ts - 通信桥接

处理主线程与 Worker 之间的消息传递：

```typescript
// 发送消息
function send(w: Worker, msg: unknown): void

// 等待响应
function wait(w: Worker): Promise<Reply>
```

### 9. server.ts - HTTP 服务

基于 Hono 框架的 HTTP 服务端点：

- **端口**：8787
- **端点**：`POST /execute`

---

## 插件系统

Isolate 基于 `@opencode/plugable` 通用插件系统，通过 **APIHook** 机制实现插件间 API 共享。

### 插件架构

```
Kernel (Plugin Manager)
    ↓
GuardPlugin → onValidate
    ↓
ToolsetPlugin → onToolset (APIHook) + onLoad
    ↓
LoaderPlugin → onLoad
    ↓
SandboxPlugin → onWorker (APIHook)
    │           │
    │           └──────────────┐
    ↓                            ↓
ClusterPlugin → onExecute (uses onWorker API)
    ↓
LoggerPlugin → onLogger (APIHook) + onFormat
```

**核心特性**：
- **Hook 扩展**: 所有插件通过 Hook 监听执行流程
- **API 共享**: SandboxPlugin 通过 `onWorker` APIHook 提供 WorkerFactory
- **工具注入**: ToolsetPlugin 通过全局上下文注入运行时工具
- **依赖注入**: ClusterPlugin 使用 SandboxPlugin 提供的 API，避免代码重复
- **拓扑排序**: 自动按依赖关系排序插件执行顺序

### 内置插件

Isolate 包含 7 个内置插件，默认使用 **GuardPlugin + ToolsetPlugin + LoaderPlugin + ChannelPlugin + ClusterPlugin + LoggerPlugin** 组合：

### GuardPlugin ✅

请求验证插件，校验输入格式、大小限制。**（默认启用）**

**Hook**: `onValidate`

### LoaderPlugin ✅

代码加载插件，将代码转换为 Base64 Data URL。**（默认启用）**

**Hook**: `onLoad`  
**依赖**: `opencode:guard`

### ChannelPlugin ✅

通信频道插件，提供 Worker 间消息总线功能。**（默认启用）**

**特性**：
- 建立主线程消息路由 (Router)
- 监听 Worker 发出的广播消息
- 自动注册 `onSpawn` 钩子拦截新 Worker

**Hook**: `onSpawn`

### ClusterPlugin ✅

Worker 集群插件，复用 Worker 实例以提升性能。**（默认启用）**

**特性**：
- 预创建 Worker 池（默认 2-8 个）
- 任务级隔离（每个任务独占 Worker）
- 自动清理空闲 Worker（默认 120 秒）
- 超时自动移除异常 Worker
- 使用 SandboxPlugin 提供的 `onWorker` API

**配置**：
```typescript
{
  min: 2,       // 最小 Worker 数
  max: 8,       // 最大 Worker 数
  idle: 120_000 // 空闲清理时间（毫秒）
}
```

**依赖**: `opencode:sandbox` (通过 onWorker API)  
**Hook**: `onExecute`  
**互斥**: 不要同时使用 `SandboxPlugin` 和 `ClusterPlugin`

### SandboxPlugin

沙箱执行插件，每次执行创建新的隔离 Worker。**（按需使用）**

**特性**：
- 注册 `onWorker` APIHook，提供 Factory
- 每次执行创建独立 Worker
- 执行完成后立即终止 Worker
- 适用于低频执行场景

**API 注册**：
```typescript
interface Factory {
  spawn: () => Process
  runner: (proc: Process, timeout: number) => Runner
}
```

**Hook**: `onExecute`, `onWorker` (APIHook)  
**依赖**: `opencode:guard`, `opencode:loader`

### LoggerPlugin ✅

日志处理插件，过滤和格式化日志输出。**（默认启用）**

**特性**：
- 注册 `onLogger` APIHook，提供 Logger
- 过滤日志条目（按级别、数量）
- 支持简单日志和结构化日志
- 最大保留 1000 条日志

**API 注册**：
```typescript
interface Logger {
  filter: (logs: readonly Entry[], options?: { minLevel?: Level; maxEntries?: number }) => Entry[]
}
```

**Hook**: `onFormat`, `onLogger` (APIHook)  
**依赖**: 无

### ToolsetPlugin ✅

工具集插件，通过全局上下文注入提供运行时工具。**（默认启用）**

**特性**：
- 注册 `onToolset` APIHook，提供 Toolset
- 使用全局上下文注入，避免代码字符串拼接
- 零性能开销（无重复编译）
- 支持动态工具注册

**工具系统架构**：

```typescript
// Tool 接口定义
interface Tool {
  name: string
  description?: string
  setup: (globals: Record<string, unknown>) => void  // 全局注入
}

// 工具注册表
interface Registry {
  [key: string]: Tool
}

// Toolset API
interface Toolset {
  tools: () => Tool[]
  registry: () => Registry
  setup: (tools: Tool[], globals: Record<string, unknown>) => void
}
```

**内置工具**：

| 工具 | 说明 | 注入内容 |
|------|------|----------|
| `crypto` | Web Crypto API | `globalThis.crypto` |
| `channel` | Worker 通信 | `globalThis.channel` |
| `db` | PostgreSQL 数据库访问 | `globalThis.db` |

**添加自定义工具**：

```typescript
import type { Tool } from '@opencode/isolate'

// 定义工具
const myTool: Tool = {
  name: 'fetch',
  description: 'HTTP 请求工具',
  setup: (globals) => {
    // 注入到全局上下文
    globals.fetch = async (url: string) => {
      // 自定义实现
      return { ok: true, data: {} }
    }
  }
}

// 使用工具
import { tools } from '@opencode/isolate/tools'
tools.push(myTool)
```

**性能优势**：

相比传统的代码字符串拼接注入方式：
- ✅ 无字符串拼接开销
- ✅ 无重复代码编译
- ✅ 更好的 JIT 缓存利用
- ✅ 用户代码保持原样，便于调试
- ✅ 支持注入任意 JavaScript 对象（函数、类、实例等）

**Hook**: `onLoad`, `onToolset` (APIHook)  
**依赖**: `opencode:guard`  
**后置**: `opencode:loader`

---

**切换到 SandboxPlugin**：

如果需要每次执行都创建新的 Worker（适用于低频场景），可以替换为 SandboxPlugin：

```typescript
import { createIsolate, SandboxPlugin } from '@opencode/isolate'

// 移除默认插件，手动指定使用 SandboxPlugin
const isolate = await createIsolate({
  plugins: [SandboxPlugin]  // 会自动加载 GuardPlugin 和 LoaderPlugin
})
```

---

## 插件与工具配置指南

### GuardPlugin 配置

控制请求校验规则。

```typescript
const isolate = await createIsolate({
  config: {
    maxSize: 50 * 1024, // 代码最大 50KB (默认 100KB)
  }
});
```

### ClusterPlugin 配置

管理 Worker 进程池的行为。

```typescript
const isolate = await createIsolate({
  config: {
    cluster: {
      min: 4,         // 最小保留 4 个 Worker
      max: 16,        // 最大扩容到 16 个
      idle: 60_000,   // 空闲 60秒后销毁
    }
  }
});
```

### LoggerPlugin 配置

过滤不需要的日志。

```typescript
// 目前 LoggerPlugin 主要通过 system config 自动工作
// 可通过 filter 钩子自定义，参考架构设计中的 onLogger
```

### Channel 工具与 API

`channel` 工具已默认注入到 Worker 环境中。

**API 签名**:

```typescript
interface Channel {
  // 发送广播消息
  emit(topic: string, data: unknown): void;
  // 订阅主题
  on(topic: string, handler: (data: unknown) => void): void;
  // 取消订阅
  off(topic: string, handler: (data: unknown) => void): void;
}
declare const channel: Channel;
```

**使用示例**:

```javascript
// Worker A: 数据生产者
export default () => {
  setInterval(() => {
    channel.emit('heartbeat', { status: 'alive', time: Date.now() });
  }, 1000);
}
```

```javascript
// Worker B: 数据消费者
export default () => {
  channel.on('heartbeat', (data) => {
    console.log('收到心跳:', data);
  });
}
```

### Database 工具与 API

`db` 工具提供 PostgreSQL 数据库访问能力，基于 Drizzle ORM。需要设置 `DATABASE_URL` 环境变量才会自动注入。

**环境配置**:

```bash
# 设置数据库连接字符串
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

**API 签名**:

```typescript
interface Database<T extends Schema> {
  // Drizzle ORM 查询实例
  query: PostgresJsDatabase<T>;
  
  // 所有 drizzle-orm 操作符和函数
  operators: typeof import('drizzle-orm');
  
  // 动态表访问（根据 schemas/ 目录中的表定义）
  [tableName: string]: AnyPgTable;
  
  // 列出所有表名
  tables: readonly string[];
  
  // 执行事务
  transaction<Result>(
    callback: (tx: PostgresJsDatabase<T>) => Promise<Result>
  ): Promise<Result>;
  
  // 关闭连接
  close(): Promise<void>;
}

declare const db: Database;
```

**Schema 定义**:

在 `apps/isolate/src/schemas/` 目录下创建表定义。仓库已内置示例表 [apps/isolate/src/schemas/users.ts](apps/isolate/src/schemas/users.ts) 和 [apps/isolate/src/schemas/posts.ts](apps/isolate/src/schemas/posts.ts)，可直接通过 `db.users` 与 `db.posts` 访问：

```typescript
// schemas/users.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**使用示例**:

```javascript
// 1. 查询所有用户
export default async () => {
  // 查询所有
  const allUsers = await db.users.select();
  
  // 条件查询（使用 Drizzle 的 where）
  const { eq } = await import('drizzle-orm');
  const users = await db.users.select().where(eq(db.users.id, 1));
  
  return users;
}
```

```javascript
// 2. 插入数据
export default async (userData) => {
  const result = await db.users
    .insert({
      name: userData.name,
      email: userData.email
    })
    .returning();
  
  return result[0];
}
```

```javascript
// 3. 更新数据
export default async ({ id, name }) => {
  const { eq } = await import('drizzle-orm');
  
  const updated = await db.users
    .update({ name })
    .where(eq(db.users.id, id))
    .returning();
  
  return updated[0];
}
```

```javascript
// 4. 删除数据
export default async (id) => {
  const { eq } = await import('drizzle-orm');
  
  await db.users
    .delete()
    .where(eq(db.users.id, id));
  
  return { success: true };
}
```

```javascript
// 5. 复杂查询（使用原生 Drizzle client）
export default async () => {
  const { eq, sql } = await import('drizzle-orm');
  
  // 使用 db.db 访问原生 Drizzle client
  const result = await db.db
    .select({
      userId: db.users.id,
      userName: db.users.name,
      postCount: sql`count(${db.posts.id})::int`
    })
    .from(db.users)
    .leftJoin(db.posts, eq(db.users.id, db.posts.userId))
    .groupBy(db.users.id)
    .having(sql`count(${db.posts.id}) > 0`);
  
  return result;
}
```

**数据库操作符**：

```javascript
// 需要从 drizzle-orm 导入操作符
const { eq, and, or, like, gt, gte, lt, lte, inArray, sql } = await import('drizzle-orm');

// 使用示例
const users = await db.users.select().where(eq(db.users.id, 1));
const posts = await db.posts.select().where(and(
  eq(db.posts.userId, 1),
  gt(db.posts.createdAt, new Date('2024-01-01'))
));
```

**DB 工具 API：**

- `db.users` - Query 实例，提供 `select()`, `insert()`, `update()`, `delete()`
- `db.posts` - 其他表的 Query 实例（根据 schemas/ 目录自动扫描）
- `db.db` - 原生 Drizzle client，用于复杂查询（JOIN、聚合等）
- `db.close()` - 关闭数据库连接

---

## 工具系统

### 工具定义

工具通过 `setup` 方法注入全局对象到隔离环境：

```typescript
// tools/crypto.ts
export const crypto: Tool = {
  name: 'crypto',
  description: 'Web Crypto API',
  setup: (globals) => {
    if (typeof globalThis.crypto === 'undefined' && typeof self.crypto !== 'undefined') {
      globals.crypto = self.crypto
    }
  }
}
```

### 工具注册

所有工具在 [tools/index.ts](apps/isolate/src/tools/index.ts) 中注册：

```typescript
import { crypto } from './crypto.ts'

// 导出工具数组
export const tools: Tool[] = [
  crypto,
  // 添加更多工具...
]

// 创建注册表
export function registry(items: Tool[]): Registry {
  const result: Registry = {}
  for (const tool of items) {
    result[tool.name] = tool
  }
  return result
}

// 默认注册表
export const defaults = registry(tools)

// 设置工具（注入到全局上下文）
export function setup(items: Tool[], globals: Record<string, unknown>): void {
  for (const tool of items) {
    tool.setup(globals)
  }
}
```

### 使用工具

工具会自动注入到用户代码的执行环境中：

```javascript
// 用户代码可以直接使用 crypto
export default async (data) => {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### 自定义工具

创建并注册自定义工具：

```typescript
// 1. 定义工具
import type { Tool } from './types.ts'

export const simpleLogger: Tool = {
  name: 'simpleLogger',
  description: '简单的结构化日志工具',
  setup: (globals) => {
    globals.simpleLogger = {
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
      debug: (msg: string) => console.log(`[DEBUG] ${msg}`)
    }
  }
}

// 2. 注册到工具数组
// tools/index.ts
import { simpleLogger } from './simpleLogger.ts'

export const tools: Tool[] = [
  crypto,
  simpleLogger,  // 添加新工具
]
```

**使用示例**：

```javascript
// 用户代码
export default (data) => {
  simpleLogger.info('开始处理数据')
  
  try {
    const result = processData(data)
    simpleLogger.info('处理完成')
    return result
  } catch (error) {
    simpleLogger.error(`处理失败: ${error.message}`)
    throw error
  }
}
```

**Database 工具示例**：

```typescript
// tools/db.ts - 完整实现
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as operators from 'drizzle-orm';
import type { Tool } from '../types.ts';
import { inject } from '../common.ts';

export const db: Tool = {
  name: 'db',
  setup: async (globals: Record<string, unknown>): Promise<void> => {
    const connection = Deno.env.get('DATABASE_URL');
    if (!connection) {
      return; // 无连接字符串时跳过
    }

    // 加载 schemas 目录中的表定义
    const schemas = await loadSchemas();
    
    // 创建数据库实例
    const client = postgres(connection);
    const instance = drizzle(client, { schema: schemas });
    
    // 创建包装对象，提供便捷 API
    const db = new Proxy({ 
      query: instance,
      operators,
      tables: Object.keys(schemas)
    }, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (prop in schemas) return schemas[prop]; // 动态表访问
        return undefined;
      }
    });
    
    // 冻结并注入全局
    Object.freeze(db);
    inject(globals, 'db', db);
  }
};
```

---

## API 接口

### POST /execute

执行用户提供的代码。

#### 请求

```http
POST /execute HTTP/1.1
Content-Type: application/json

{
  "code": "export default (x) => x * 2",
  "input": 21,
  "entry": "default",
  "timeout": 3000
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | ✅ | 要执行的 JavaScript/TypeScript 代码 |
| `input` | any | ❌ | 传递给入口函数的参数 |
| `entry` | string | ❌ | 入口函数名称（默认：`"default"`） |
| `timeout` | number | ❌ | 超时时间（毫秒，默认：3000） |

#### 响应

**成功 (200)**：

```json
{
  "ok": true,
  "result": 42,
  "logs": [
    { "level": "log", "message": "计算中...", "timestamp": 1234567890 },
    { "level": "info", "message": "完成", "timestamp": 1234567891 }
  ],
  "duration": 15
}
```

**执行失败 (200 - 异常在 logs 中)**：

```json
{
  "ok": false,
  "logs": [
    { 
      "level": "exception", 
      "message": "x is not a function",
      "name": "TypeError",
      "stack": "TypeError: x is not a function\n    at...",
      "timestamp": 1234567890 
    }
  ],
  "duration": 5
}
```

**负载过大 (413)**：

```json
{
  "error": {
    "name": "PayloadTooLarge",
    "message": "large"
  }
}
```

#### 响应状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 执行成功 |
| 413 | 代码体积超过限制 |
| 500 | 执行过程中发生错误 |

---

## 使用场景

### 1. 在线代码执行平台

为编程学习网站提供安全的代码执行环境：

```typescript
import { createIsolate } from '@opencode/isolate'

const isolate = await createIsolate({
  config: { 
    timeout: 5000,  // 学生代码可能需要更长时间
    maxSize: 50_000 // 限制代码大小
  }
})

// 执行学生提交的代码
const result = await isolate.execute({
  code: studentCode,
  input: testCases,
  entry: 'solution'
})

if (result.ok) {
  console.log('测试通过:', result.result)
  console.log('执行日志:', result.logs)
} else {
  console.error('错误:', result.error.message)
}
```

### 2. Serverless 函数执行

作为 FaaS 平台的执行引擎：

```typescript
// 使用 Worker 集群模式优化性能
const isolate = await createIsolate({
  useCluster: true,  // 默认启用
  config: { timeout: 3000 }
})

// 高并发场景下复用 Worker
const results = await Promise.all(
  requests.map(req => isolate.execute({
    code: req.functionCode,
    input: req.payload
  }))
)
```

### 3. 数据转换管道

安全执行用户自定义的数据转换逻辑：

```typescript
const transformCode = `
export default function transform(data) {
  return data
    .filter(item => item.price > 100)
    .map(item => ({
      id: item.id,
      total: item.price * item.quantity
    }))
}
`

const result = await isolate.execute({
  code: transformCode,
  input: rawData,
  entry: 'transform'
})
```

### 4. 插件系统

为应用提供安全的插件运行环境：

```typescript
interface Plugin {
  name: string
  code: string
  hooks: string[]
}

async function runPlugin(plugin: Plugin, hookName: string, data: unknown) {
  const result = await isolate.execute({
    code: plugin.code,
    input: { hook: hookName, data },
    entry: 'onHook'
  })
  
  return result.ok ? result.result : null
}
```

### 5. 规则引擎

执行业务规则和策略：

```typescript
const ruleCode = `
export default function evaluateRule(order) {
  if (order.amount > 1000) return { discount: 0.1 }
  if (order.items.length > 5) return { discount: 0.05 }
  return { discount: 0 }
}
`

const result = await isolate.execute({
  code: ruleCode,
  input: orderData
})

const { discount } = result.result
```

---

## 错误处理

### 错误类型

Isolate 使用 **errorish** 库统一处理所有类型的错误，包括非标准错误（如 `throw 1`）。

#### 1. 代码语法错误

```javascript
// 用户代码
export default (x) => { return x +  // 语法错误
```

**响应**：
```json
{
  "ok": false,
  "duration": 1,
  "logs": [
    {
      "level": "exception",
      "message": "Unexpected end of input",
      "name": "SyntaxError",
      "stack": "...",
      "timestamp": 1234567890
    }
  ]
}
```

#### 2. 运行时错误

```javascript
// 用户代码
export default (x) => {
  return x.foo.bar  // TypeError: Cannot read property 'bar' of undefined
}
```

**响应**：
```json
{
  "ok": false,
  "duration": 2,
  "logs": [
    { 
      "level": "exception",
      "message": "Cannot read property 'bar' of undefined",
      "name": "TypeError",
      "stack": "...",
      "timestamp": 1234567890 
    }
  ]
}
```

#### 3. 非标准错误

使用 **errorish** 处理原始值抛出：

```javascript
// 用户代码
export default (x) => {
  throw 404  // 抛出数字
}
```

**响应**：
```json
{
  "ok": false,
  "duration": 1,
  "logs": [
    { 
      "level": "exception",
      "message": "404",
      "name": "Exception",
      "stack": "...",
      "timestamp": 1234567890 
    }
  ]
}
```

#### 4. 超时错误

```javascript
// 用户代码
export default () => {
  while(true) {}  // 无限循环
}
```

**响应**：
```json
{
  "ok": false,
  "duration": 3000,
  "logs": [
    {
      "level": "exception",
      "message": "Execution timeout",
      "name": "TimeoutError",
      "stack": "...",
      "timestamp": 1234567890
    }
  ]
}
```

#### 5. 入口函数错误

```javascript
// 用户代码
export default "not a function"
```

**响应**：
```json
{
  "ok": false,
  "duration": 0,
  "logs": [
    {
      "level": "exception",
      "message": "Entry \"default\" is not a function",
      "name": "EntryError",
      "stack": "...",
      "timestamp": 1234567890
    }
  ]
}
```

### 错误处理最佳实践

#### 客户端处理

```typescript
interface ExecuteResult {
  ok: boolean
  result?: unknown
  logs?: Array<{
    level: 'log' | 'info' | 'warn' | 'error' | 'exception'
    message: string
    timestamp: number
    name?: string    // exception 专用
    stack?: string   // exception 专用
  }>
  duration: number
}

async function safeExecute(code: string, input: unknown): Promise<unknown> {
  try {
    const response = await fetch('http://localhost:8787/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, input })
    })
    
    const result: ExecuteResult = await response.json()
    
    // 检查执行是否成功
    if (!result.ok) {
      // 查找异常日志
      const exception = result.logs?.find(log => log.level === 'exception')
      if (exception) {
        console.error(`[${exception.name}] ${exception.message}`)
        
        // 根据错误类型做不同处理
        switch (exception.name) {
          case 'TimeoutError':
            throw new Error('代码执行超时，请优化算法')
          case 'EntryError':
            throw new Error('找不到指定的函数')
          case 'PayloadTooLarge':
            throw new Error('代码体积过大')
          default:
            throw new Error(`执行失败: ${exception.message}`)
        }
      }
    }
    
    return result.result
  } catch (error) {
    console.error('请求失败:', error)
    throw error
  }
}
```

#### 服务端错误监控

```typescript
import { createIsolate } from '@opencode/isolate'

const isolate = await createIsolate()

// 添加错误监控中间件
app.post('/execute', async (c) => {
  const request = await c.req.json()
  const result = await isolate.execute(request)
  
  // 记录错误到监控系统
  if (!result.ok) {
    await errorTracker.log({
      type: result.error.name,
      message: result.error.message,
      code: request.code.substring(0, 100),
      duration: result.duration,
      timestamp: Date.now()
    })
  }
  
  return c.json(result)
})
```

---

## 日志系统

### 流式日志架构

Isolate 实现了**实时流式日志**，用户代码执行过程中产生的日志会立即发送到主线程。

#### 架构图

```
┌─────────────────────────────────────────────┐
│            Worker (隔离环境)                  │
├─────────────────────────────────────────────┤
│  console.log("step 1")                      │
│      ↓ 立即发送                              │
│  postMessage({ type: "log", data: ... })    │
│                                             │
│  console.log("step 2")                      │
│      ↓ 立即发送                              │
│  postMessage({ type: "log", data: ... })    │
│                                             │
│  return result                              │
│      ↓ 最后发送                              │
│  postMessage({ type: "result", data: ... }) │
└─────────────────────────────────────────────┘
         ↓                ↓                ↓
┌─────────────────────────────────────────────┐
│         Bridge (主线程收集器)                 │
├─────────────────────────────────────────────┤
│  const logs: string[] = []                  │
│  const structured: LogEntry[] = []          │
│                                             │
│  收到 type="log" → 添加到数组                │
│  收到 type="result" → 合并日志并返回          │
└─────────────────────────────────────────────┘
```

### 日志捕获

Worker 内部拦截所有 console 方法：

```typescript
// worker.ts 中的实现
function capture(level: LogLevel) {
  return (...args: unknown[]) => {
    const message = args
      .map(x => typeof x === 'string' ? x : JSON.stringify(x))
      .join(' ')
    
    const entry: LogEntry = {
      level,        // 'log' | 'info' | 'warn' | 'error'
      message,      // 格式化后的字符串
      timestamp: Date.now()
    }
    
    // 立即发送到主线程
    self.postMessage({ type: 'log', data: entry })
  }
}

console.log = capture('log')
console.info = capture('info')
console.warn = capture('warn')
console.error = capture('error')
```

### 错误日志

所有错误都会自动转换为日志：

#### 1. 捕获的异常

```javascript
export default () => {
  console.log("开始执行")
  throw new Error("出错了")
}
```

**日志输出**：
```json
{
  "logs": [
    { "level": "log", "message": "开始执行", "timestamp": 1234567890 },
    { "level": "error", "message": "Error: 出错了", "timestamp": 1234567891 }
  ]
}
```

#### 2. 全局错误

```javascript
export default () => {
  setTimeout(() => {
    throw new Error("异步错误")
  }, 10)
}
```

拦截全局错误事件：
```typescript
self.addEventListener('error', (event: ErrorEvent) => {
  const error = normalize(event.error)
  const entry: LogEntry = {
    level: 'exception',
    message: error.message,
    name: error.name,
    stack: error.stack,
    timestamp: Date.now()
  }
  self.postMessage({ type: 'log', data: entry })
})
```

#### 3. 未捕获的 Promise 拒绝

```javascript
export default async () => {
  Promise.reject("Promise 失败")
}
```

拦截 Promise 拒绝：
```typescript
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const error = normalize(event.reason)
  const entry: LogEntry = {
    level: 'exception',
    message: error.message,
    name: error.name,
    stack: error.stack,
    timestamp: Date.now()
  }
  self.postMessage({ type: 'log', data: entry })
})
```

### 日志结构

#### LogEntry 类型

```typescript
// 日志级别
type LogLevel = 
  | 'log'        // console.log
  | 'info'       // console.info
  | 'warn'       // console.warn
  | 'error'      // console.error
  | 'exception'  // 代码执行异常（throw、未捕获的 Promise rejection）

type LogEntry = {
  level: LogLevel
  message: string      // 格式化后的日志内容
  timestamp: number    // Unix 时间戳（毫秒）
  name?: string        // 异常名称（仅 level='exception' 时）
  stack?: string       // 异常堆栈（仅 level='exception' 时）
}
```

#### Output 日志字段

```typescript
type Output = {
  ok: boolean                     // true: 成功执行, false: 发生异常
  result?: unknown                // 执行结果（仅当 ok=true 时）
  logs?: readonly LogEntry[]      // 统一的日志数组（包含 console 和异常）
  duration: number                // 执行耗时（毫秒）
}
```

**重要特性**：
- `ok: true` 表示代码成功执行，`result` 包含返回值
- `ok: false` 表示发生阻塞性异常（throw、未捕获的 Promise rejection）
- 所有异常作为 `level: 'exception'` 的 LogEntry 记录在 `logs` 中
- `exception` 级别的日志包含 `name`、`message` 和 `stack` 字段
}
```

**注意**：只有在有日志时才会包含 `logs` 字段。

### 日志过滤（LoggerPlugin）

LoggerPlugin 提供日志后处理功能：

```typescript
interface FilterOptions {
  minLevel?: 'log' | 'info' | 'warn' | 'error' | 'exception'
  maxEntries?: number
}

// 自动限制最大日志数
api.onFormat.tap((output: Output) => {
  if (output.structuredLogs && output.structuredLogs.length > 0) {
    const filtered = filter(output.structuredLogs, {
      maxEntries: 1000  // 最多保留 1000 条
    })
    return { ...output, structuredLogs: filtered }
  }
  return output
})
```

### 使用示例

#### 带日志的计算

```javascript
export default (n) => {
  console.log("开始计算斐波那契")
  console.info(`输入: n = ${n}`)
  
  if (n <= 1) {
    console.warn("n 太小，直接返回")
    return n
  }
  
  let a = 0, b = 1
  for (let i = 2; i <= n; i++) {
    console.log(`第 ${i} 项: ${a + b}`)
    ;[a, b] = [b, a + b]
  }
  
  console.info("计算完成")
  return b
}
```

**响应**：
```json
{
  "ok": true,
  "result": 5,
  "duration": 3,
  "logs": [
    { "level": "log", "message": "开始计算斐波那契", "timestamp": 1234567890 },
    { "level": "info", "message": "输入: n = 5", "timestamp": 1234567891 },
    { "level": "log", "message": "第 2 项: 1", "timestamp": 1234567892 },
    { "level": "log", "message": "第 3 项: 2", "timestamp": 1234567893 },
    { "level": "log", "message": "第 4 项: 3", "timestamp": 1234567894 },
    { "level": "log", "message": "第 5 项: 5", "timestamp": 1234567895 },
    { "level": "info", "message": "计算完成", "timestamp": 1234567896 }
  ]
}
```

---

## 安全机制

### 1. 权限隔离

Worker 创建时使用 `permissions: "none"` 配置：

```typescript
const options = { 
  type: "module", 
  deno: { permissions: "none" }  // 禁用所有权限
}
```

**禁用的能力**：
- ❌ 网络访问（`--allow-net`）
- ❌ 文件系统读取（`--allow-read`）
- ❌ 文件系统写入（`--allow-write`）
- ❌ 环境变量访问（`--allow-env`）
- ❌ 子进程执行（`--allow-run`）
- ❌ 高精度时间（`--allow-hrtime`）
- ❌ FFI 调用（`--allow-ffi`）

### 2. 超时保护

防止无限循环或长时间运行的代码：

```typescript
const timer = new Promise<Output>((resolve) => {
  setTimeout(() => {
    kill()  // 强制终止 Worker
    resolve({ ok: false, error: { name: "TimeoutError", message: "timeout" }, ... })
  }, timeout)
})
```

### 3. 代码大小限制

防止过大的代码负载：

```typescript
const size = 100_000  // 最大 100KB

if (code.length > size) {
  throw PayloadTooLarge
}
```

### 4. Worker 强制终止

执行完成后立即终止 Worker：

```typescript
const kill = () => { 
  try { 
    worker.terminate() 
  } catch { } 
}
```

---

## 使用指南

### 开发环境

```bash
# 启动开发服务器（自动热重载）
deno task dev

# 或使用 pnpm
pnpm dev
```

### 插件配置 (Plugin Configuration)

Isolate 的行为可以通过 `Config` 对象进行精细控制：

#### 1. 守卫插件 (Guard Plugin)
控制代码执行的安全限制，防止恶意代码占用过多资源。

```typescript
const isolate = await createIsolate({
  config: {
    // 代码最大体积 (bytes), 默认 100KB
    maxSize: 100_000, 
    // 执行超时时间 (ms), 默认 3000ms
    timeout: 3_000, 
  }
})
```

#### 2. 集群插件 (Cluster Plugin)
管理 Worker 资源池以提升高并发性能。

```typescript
// 默认启用集群模式
const isolate = await createIsolate({
  useCluster: true, // 设置为 false 可禁用集群，每次新建 Worker
  // 如果需要自定义集群参数，需在源码或配置加载处修改 ClusterOptions
  // 默认策略: min=2, max=8, idle=120000ms
})
```

#### 3. 日志插件 (Logger Plugin)
自动捕获 `console` 输出。可以通过 `onLogger` 钩子自定义日志处理逻辑，包括日志级别过滤 (`log`, `info`, `warn`, `error`) 和条数限制。

### 内置工具库 (Tools API)

在沙箱内运行的代码中，可以直接使用以下预置工具：

#### 通信工具 (Channel)

用于 Worker 实例间的实时消息广播。适用于需要多个 Worker 协同工作的场景。

**API 定义**:
*   `channel.emit(topic: string, data: any)`: 发送消息到特定主题。此消息会被广播给集群中的其他所有 Worker。
*   `channel.on(topic: string, handler: Function)`: 订阅特定主题的消息。
*   `channel.off(topic: string, handler: Function)`: 取消订阅。

**使用示例**:

```javascript
// Worker A
export default function() {
  // 向 'chat' 主题广播消息
  channel.emit('chat', { user: 'Alice', text: 'Hello from Worker A' });
  return 'Sent';
}
```

```javascript
// Worker B
export default async function() {
  return new Promise((resolve) => {
    // 监听 'chat' 主题
    channel.on('chat', (msg) => {
      console.log(`Received: ${msg.text}`);
      resolve(msg);
    });
  });
}
```

### 基础请求示例

#### 执行简单代码
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"code": "export default (x) => x * 2", "input": 21}'
```

#### 指定入口函数
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export function add(x) { return x.a + x.b }",
    "input": {"a": 1, "b": 2},
    "entry": "add"
  }'
```

#### 使用内置工具
```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async (msg) => { const hash = await crypto.subtle.digest(\"SHA-256\", new TextEncoder().encode(msg)); return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, \"0\")).join(\"\") }",
    "input": "hello world"
  }'
```

#### 使用数据库工具

```bash
# 需要先设置环境变量
export DATABASE_URL="postgresql://localhost:5432/test"

# 查询用户
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async () => { const { eq } = db.operators; return await db.query.select().from(db.users).where(eq(db.users.id, 1)); }",
    "input": null
  }'

# 插入数据
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async (data) => { const result = await db.query.insert(db.users).values(data).returning(); return result[0]; }",
    "input": {"name": "Alice", "email": "alice@example.com"}
  }'
```

#### 使用通信工具

Channel 工具用于 **Worker 间通信**，消息会广播给集群中的**其他 Worker**（不包括发送者自己）。

**单次请求示例**（仅演示API，无法接收消息）：

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default (msg) => { channel.emit(\"broadcast\", { text: msg }); return \"Message sent to other workers\" }",
    "input": "Hello from curl"
  }'
```

**预期响应**:
```json
{
  "ok": true,
  "result": "Message sent to other workers",
  "duration": 2
}
```

**注意**：
- Channel 消息不会发送给发送者自己
- 需要至少 2 个并发请求才能展示完整的通信效果
- 适用于需要 Worker 间协作的场景（如分布式任务、状态同步）

---

## 技术细节

### 核心架构 (Kernel & Plugins)

Isolate 基于微内核架构，核心逻辑由 `@opencode/plugable` 提供的插件系统驱动。

*   **插件管理器 (Manager)**: `src/kernel.ts` 中初始化 `Manager`，注册了默认插件链：`GuardPlugin` -> `ToolsetPlugin` -> `LoaderPlugin` -> `SandboxPlugin` -> `ChannelPlugin` -> `ClusterPlugin` -> `LoggerPlugin`。
*   **生命周期钩子 (Hooks)**:
    *   `onValidate` (Async): 验证请求格式、大小、超时设置。
    *   `onLoad` (Async): 将代码转换为可执行格式（Data URL）。
    *   `onSpawn` (Sync): 创建或获取 Worker 实例。
    *   `onExecute` (Async): 执行代码并等待结果。
    *   `onFormat` (Async): 格式化输出结果。

### 沙箱与注入机制 (Sandbox Implementation)

沙箱环境的构建主要依赖于 `src/common.ts` 和 `src/worker.ts` 中的机制：

*   **Bootstrap**: Worker 启动时调用 `bootstrap` 函数，将工具（Tools）和全局变量注入到 `globalThis` 作用域。
*   **Property Injection**: 使用 `inject` 辅助函数，通过 `Object.defineProperty` 将属性定义为 `writable: false`, `configurable: false`，确保沙箱内无法修改关键全局对象。
*   **Tool Registry**: 提供了 `registry` 和 `setup` 机制，可以在 Worker 内部按需加载工具集（如 `crypto`, `channel`）。
*   **Code Execution**: 用户代码被转换为 Data URL 格式 (`data:application/javascript;base64,...`)，Worker内部使用动态 `import()` 加载执行，既保证了隔离性，又支持了 ES Module 特性。

### 通信总线 (Event Bus)

实现了基于 Host-Mediated Star Topology 的通信机制，详见 `src/plugins/channel.ts` 和 `src/tools/channel.ts`：

*   **路由逻辑**: `ChannelPlugin` 在 Host 端监听所有 Worker 的 `message` 事件。当收到 type 为 `channel` 的消息时，它会遍历维护的 `clients` 集合。
*   **消息广播**: 消息会被转发给除发送者以外的所有其他 Worker (`client !== worker`)，实现广播效果。
*   **Worker API**: Worker 内部通过 `src/tools/channel.ts` 暴露简单的 `emit/on/off` 接口，底层通过 `postMessage` 与 Host 通信。

### Worker 运行时 (Worker Runtime)

`src/worker.ts` 承载了 Worker 的主逻辑：

*   **日志捕获**: 重写 `console` 对象的方法，将日志序列化后发送回 Host。
*   **异常处理**: 监听 `error` 和 `unhandledrejection` 事件，标准化错误信息。
*   **安全序列化**: 使用自定义的 `safeStringify` 处理循环引用，防止 JSON 序列化崩溃。

---

## 最佳实践

### 1. 选择合适的执行模式

**使用 ClusterPlugin（默认）**：
- ✅ 高频执行场景（QPS > 10）
- ✅ 代码执行时间短（< 1s）
- ✅ 服务器环境，内存充足
- ✅ 需要快速响应时间

**使用 SandboxPlugin**：
- ✅ 低频执行场景（QPS < 5）
- ✅ 代码执行时间长（> 5s）
- ✅ 内存受限环境
- ✅ 严格隔离要求（每次创建新 Worker）

```typescript
// 低频场景
const isolate = await createIsolate({
  useCluster: false  // 使用 SandboxPlugin
})
```

### 2. 合理设置超时时间

```typescript
const isolate = await createIsolate({
  config: {
    timeout: 3000  // 根据实际需求调整
  }
})

// 或在请求中指定
await isolate.execute({
  code,
  input,
  timeout: 5000  // 覆盖默认配置
})
```

**推荐值**：
- 简单计算：1000-3000ms
- 复杂算法：3000-10000ms
- 数据处理：5000-15000ms

### 3. 代码大小限制

```typescript
const isolate = await createIsolate({
  config: {
    maxSize: 100_000  // 100KB（默认）
  }
})
```

**建议**：
- 一般代码：50-100KB
- 大型模块：100-500KB
- 注意：代码越大，加载越慢

### 4. 错误处理

```typescript
const result = await isolate.execute({ code, input })

if (!result.ok) {
  // 始终检查 ok 字段
  console.error(`[${result.error.name}] ${result.error.message}`)
  
  // 根据错误类型处理
  if (result.error.name === 'TimeoutError') {
    // 超时处理
  } else if (result.error.name === 'EntryError') {
    // 入口函数错误处理
  }
}
```

### 5. 日志管理

```typescript
// 生产环境：只记录错误日志
if (!result.ok && result.logs) {
  errorLogger.log({
    error: result.error,
    logs: result.logs.filter(log => log.level === 'error'),
    code: code.substring(0, 100)
  })
}

// 开发环境：输出所有日志
if (isDev && result.logs) {
  result.logs.forEach(log => {
    console.log(`[${log.level}] ${log.message}`)
  })
}
```

### 6. 输入验证

```typescript
// 在传递给 isolate 之前验证输入
function validateInput(input: unknown): boolean {
  // 检查输入大小
  const size = JSON.stringify(input).length
  if (size > 1_000_000) return false  // 限制 1MB
  
  // 检查输入类型
  if (typeof input !== 'object' && typeof input !== 'number' && typeof input !== 'string') {
    return false
  }
  
  return true
}

if (!validateInput(userInput)) {
  throw new Error('Invalid input')
}

const result = await isolate.execute({ code, input: userInput })
```

### 7. 代码缓存

```typescript
const codeCache = new Map<string, string>()

function getCachedCode(userId: string, codeId: string): string | null {
  const key = `${userId}:${codeId}`
  return codeCache.get(key) || null
}

function setCachedCode(userId: string, codeId: string, code: string) {
  const key = `${userId}:${codeId}`
  codeCache.set(key, code)
  
  // 限制缓存大小
  if (codeCache.size > 1000) {
    const firstKey = codeCache.keys().next().value
    codeCache.delete(firstKey)
  }
}
```

### 8. 资源清理

```typescript
// 应用关闭时清理资源
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，开始清理...')
  
  // ClusterPlugin 会自动清理 Worker 池
  // 无需手动清理
  
  process.exit(0)
})
```

---

## 性能优化

### 工具系统性能

工具系统使用**全局上下文注入**方式，相比传统的代码字符串拼接具有显著性能优势：

#### 性能对比

| 指标 | 字符串拼接注入 | 全局上下文注入 |
|------|---------------|---------------|
| 代码编译 | 每次都需要 | 无需编译 |
| 内存占用 | 代码体积增加 | 仅对象引用 |
| JIT 优化 | 缓存失效 | 完全缓存 |
| 调试体验 | 代码混入 | 用户代码原样 |

#### 实现原理

```typescript
// ❌ 旧方式：字符串拼接（已废弃）
const injectionCode = `
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = self.crypto;
}
`
const augmentedCode = injectionCode + '\n\n' + userCode
// 问题：每次执行都要编译更大的代码

// ✅ 新方式：全局上下文注入
const globals: Record<string, unknown> = {}
tool.setup(globals)  // 注入对象到 globals
// 优势：直接在执行环境中设置全局对象，零开销
```

#### 性能测试

```typescript
// 测试场景：1000 次执行
// 代码大小：1KB
// 工具数量：5 个

// 字符串拼接方式：
// - 平均耗时：15ms
// - 内存峰值：50MB
// - 编译次数：1000 次

// 全局上下文注入：
// - 平均耗时：12ms（提升 20%）
// - 内存峰值：30MB（减少 40%）
// - 编译次数：0 次（用户代码独立编译）
```

### Worker 集群优化

#### 1. 调整集群大小

```typescript
const isolate = await createIsolate({
  plugins: [ClusterPlugin],
  config: {
    cluster: {
      min: 4,        // 根据 CPU 核心数调整
      max: 16,       // 根据内存大小调整
      idle: 60_000   // 缩短空闲时间以节省内存
    }
  }
})
```

**公式**：
- `min` = CPU 核心数 × 0.5
- `max` = CPU 核心数 × 2
- `idle` = 根据请求频率调整（高频用 120s，低频用 30s）

#### 2. 监控集群状态

```typescript
// 添加监控中间件
app.use(async (c, next) => {
  const start = performance.now()
  await next()
  const duration = performance.now() - start
  
  // 记录慢请求
  if (duration > 1000) {
    console.warn(`慢请求: ${duration}ms`)
  }
})
```

### 代码加载优化

#### 1. 使用 Data URL 缓存

```typescript
const dataUrlCache = new Map<string, string>()

function getDataUrl(code: string): string {
  const hash = hashCode(code)
  
  if (dataUrlCache.has(hash)) {
    return dataUrlCache.get(hash)!
  }
  
  const url = `data:application/javascript;base64,${btoa(code)}`
  dataUrlCache.set(hash, url)
  return url
}
```

#### 2. 压缩代码

```typescript
import { minify } from 'terser'

async function compressCode(code: string): Promise<string> {
  const result = await minify(code, {
    compress: true,
    mangle: false  // 保持函数名不变
  })
  return result.code || code
}
```

### 并发控制

```typescript
import PQueue from 'p-queue'

const queue = new PQueue({ concurrency: 10 })

async function executeWithQueue(code: string, input: unknown) {
  return queue.add(() => isolate.execute({ code, input }))
}

// 批量执行
const results = await Promise.all(
  requests.map(req => executeWithQueue(req.code, req.input))
)
```

### 内存优化

#### 1. 限制日志大小

```typescript
// 在 LoggerPlugin 中配置
api.onFormat.tap((output: Output) => {
  if (output.logs && output.logs.length > 100) {
    return {
      ...output,
      logs: output.logs.slice(-100)  // 只保留最后 100 条
    }
  }
  return output
})
```

#### 2. 定期清理缓存

```typescript
setInterval(() => {
  codeCache.clear()
  dataUrlCache.clear()
  console.log('缓存已清理')
}, 3600_000)  // 每小时清理一次
```

---

## 常见问题

### Q1: 为什么第一次执行比较慢？

**A**: Worker 创建需要时间（~50-100ms）。ClusterPlugin 会预创建 Worker 池，但首次执行仍需要初始化。

**解决方案**：
```typescript
// 应用启动时预热
const isolate = await createIsolate({ useCluster: true })

// 执行一个简单的预热请求
await isolate.execute({
  code: 'export default () => 1',
  input: null
})
```

### Q2: 如何处理长时间运行的任务？

**A**: 增加超时时间，或使用后台任务队列。

```typescript
// 方案 1: 增加超时
const result = await isolate.execute({
  code,
  input,
  timeout: 30_000  // 30 秒
})

// 方案 2: 使用任务队列
import { Queue } from 'bullmq'

const queue = new Queue('isolate-tasks')
await queue.add('execute', { code, input })
```

### Q3: 如何调试用户代码？

**A**: 使用日志系统查看执行过程。

```typescript
const result = await isolate.execute({ code, input })

if (!result.ok) {
  console.error('错误:', result.error)
  console.error('日志:', result.logs)
  console.error('堆栈:', result.error.stack)
}
```

### Q4: Worker 池耗尽怎么办？

**A**: 增加 `max` 值或使用队列限流。

```typescript
const isolate = await createIsolate({
  plugins: [ClusterPlugin],
  config: {
    cluster: {
      max: 32  // 增加最大 Worker 数
    }
  }
})
```

### Q5: 如何支持异步代码？

**A**: 直接使用 async/await，Worker 会等待 Promise 完成。

```javascript
// 用户代码
export default async (input) => {
  // 可以使用 async/await
  const result = await someAsyncOperation(input)
  return result
}
```

### Q6: 可以使用 npm 包吗？

**A**: 不能。Worker 运行在 `permissions: "none"` 模式下，无法访问文件系统和网络。

**替代方案**：
- 将常用工具函数内置到代码中
- 通过 input 参数传递所需数据
- 使用纯 JavaScript 实现

### Q7: 如何限制用户代码的资源使用？

**A**: 使用超时、代码大小限制和 Worker 隔离。

```typescript
const isolate = await createIsolate({
  config: {
    timeout: 3000,     // 限制执行时间
    maxSize: 50_000    // 限制代码大小
  }
})

// Worker 自动隔离：
// - 无文件系统访问
// - 无网络访问
// - 无环境变量访问
```

### Q8: 性能瓶颈在哪里？

**A**: 主要瓶颈：
1. Worker 创建时间（~50-100ms）→ 使用 ClusterPlugin
2. 代码加载时间（取决于代码大小）→ 压缩代码
3. 消息传递开销（~1-5ms）→ 减少日志量

---

## 配置说明

### deno.json

```json
{
  "nodeModulesDir": "auto",
  "unstable": ["worker-options"],  // 启用 Worker 权限控制
  "tasks": {
    "dev": "deno run --allow-net --allow-read=./src --watch src/server.ts"
  },
  "imports": {
    "hono": "npm:hono@4.4.11"
  },
  "compilerOptions": {
    "lib": ["deno.ns", "deno.worker", "esnext"],
    "strict": true
  }
}
```

### 服务器权限

开发模式下，服务器仅需要以下权限：

| 权限 | 说明 |
|------|------|
| `--allow-net` | HTTP 服务监听 |
| `--allow-read=./src` | 读取源代码文件 |

---

## 项目结构

```
apps/isolate/
├── deno.json          # Deno 配置
├── package.json       # npm 兼容
├── README.md
└── src/
    ├── bridge.ts      # Worker 通信
    ├── common.ts      # 通用工具
    ├── config.ts      # 默认配置
    ├── index.ts       # 入口导出
    ├── kernel.ts      # 微内核
    ├── server.ts      # HTTP 服务
    ├── types.ts       # 类型定义
    ├── worker.ts      # Worker 执行器
    ├── plugins/
    │   ├── channel.ts # 通信插件
    │   ├── cluster.ts # 集群插件（复用）
    │   ├── guard.ts   # 验证插件
    │   ├── index.ts   # 插件导出
    │   ├── loader.ts  # 加载插件
    │   ├── logger.ts  # 日志插件
    │   ├── sandbox.ts # 沙箱插件（单次执行）
    │   └── toolset.ts # 工具集插件
    └── tools/
        ├── channel.ts # Channel 工具
        ├── crypto.ts  # Crypto 工具
        └── index.ts   # 工具导出
```

---

## 性能对比

### SandboxPlugin vs ClusterPlugin

| 指标 | SandboxPlugin | ClusterPlugin |
|------|--------------|---------------|
| Worker 创建 | 每次执行 | 预创建 + 复用 |
| 冷启动时间 | ~50-100ms | ~50-100ms（首次） |
| 热执行时间 | 基准 | 减少 50-100ms |
| 并发能力 | 无限制（创建新 Worker） | 受集群大小限制 |
| 内存占用 | 单次峰值低 | 持续占用高 |
| 适用场景 | 低频执行 | 高频执行 |

---

## License

MIT © OpenCode
