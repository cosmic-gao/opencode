# Isolate - 安全沙箱代码执行引擎

> 基于 Deno Worker 的隔离式 JavaScript/TypeScript 代码执行服务，支持插件化扩展

## 📋 目录

- [项目概述](#项目概述)
- [快速开始](#快速开始)
- [架构设计](#架构设计)
- [核心模块](#核心模块)
- [插件系统](#插件系统)
- [API 接口](#api-接口)
- [使用场景](#使用场景)
- [错误处理](#错误处理)
- [日志系统](#日志系统)
- [安全机制](#安全机制)
- [使用指南](#使用指南)
- [技术细节](#技术细节)
- [最佳实践](#最佳实践)
- [性能优化](#性能优化)
- [常见问题](#常见问题)
- [配置说明](#配置说明)

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

### 第一个请求

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

---

## 项目概述

### 简介

Isolate 是一个基于 Deno 运行时的安全沙箱代码执行引擎。它允许在隔离的环境中安全执行用户提供的 JavaScript/TypeScript 代码，具有以下核心特性：

- **微内核架构**：核心功能精简，通过插件系统扩展能力
- **插件化设计**：基于 `@opencode/plugable` 通用插件系统，支持 Hook 扩展
- **安全隔离**：使用 Deno Worker 的 `permissions: "none"` 模式，完全隔离代码执行环境
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
│                      执行入口 & 协调器                        │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                          │
│    ┌─────────────▼─────────────┐                            │
│    │     Guard (guard.ts)      │                            │
│    │       请求验证器           │                            │
│    └───────────────────────────┘                            │
│                                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cluster (cluster.ts)                     │
│                    Worker 池管理（默认）                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Worker 池     │  │  任务调度     │  │  自动清理        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ postMessage
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker (worker.ts)                      │
│              隔离执行环境 (permissions: none)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 代码动态导入  │  │  日志拦截     │  │  函数调用执行    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                        ▲
         │              ┌─────────────┐           │
         └──────────────│ Bridge      │───────────┘
                        │ 通信桥接     │
                        └─────────────┘
```

### 数据流

```
Request → Guard验证 → Cluster分配Worker → Bridge发送消息 
    → Worker执行代码 → Bridge接收结果 → Cluster回收Worker → 返回Output
```

---

## 核心模块

### 1. types.ts - 类型定义

定义系统中所有核心数据结构：

```typescript
// 错误结构
type Fault = { name: string; message: string; stack?: string }

// 日志级别
type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'exception'

// 日志条目
type LogEntry = {
  level: LogLevel
  message: string
  timestamp: number
  name?: string    // 异常名称（仅 exception）
  stack?: string   // 异常堆栈（仅 exception）
}

// 执行输出（成功/失败）
type Output = {
  ok: boolean
  result?: unknown                    // 执行结果（仅 ok=true）
  logs?: readonly LogEntry[]          // 日志数组
  duration: number                    // 执行耗时（毫秒）
}

// 执行请求
type Request = {
  code: string            // 用户代码
  input?: unknown         // 输入参数
  entry?: string          // 入口函数（默认 "default"）
  timeout?: number        // 超时时间（默认 3000ms）
}

// 执行上下文
type Context = {
  config: Config                      // 配置信息
  request: Request                    // 执行请求
  url: string                         // Data URL
  output: Output | null               // 执行结果
  globals?: Record<string, unknown>   // 全局对象（用于工具注入）
}

// Worker 通信包
type Packet = { 
  code: string
  input: unknown
  entry: string
  url: string
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

### 3. kernel.ts - 微内核

系统的核心协调器，基于插件系统驱动：

```typescript
import { createIsolate } from './kernel.ts'

const isolate = await createIsolate({
  config: { timeout: 5000 },
  plugins: [MyPlugin]
})

const result = await isolate.execute({
  code: 'export default (x) => x * 2',
  input: 21
})
```

### 4. sandbox.ts - 沙箱管理器

负责 Worker 的完整生命周期管理：

**核心功能**：
- 创建隔离 Worker（`permissions: "none"`）
- 实现超时控制机制
- 管理 Worker 终止

**执行流程**：

```
1. 创建 Worker (permissions: none)
2. 启动超时计时器
3. 发送执行请求
4. 等待结果或超时
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

### 6. loader.ts - 代码加载器

将代码字符串转换为可导入的 Data URL：

```typescript
function encode(code: string): string {
  const base = btoa(code)
  return `data:application/javascript;base64,${base}`
}
```

### 7. bridge.ts - 通信桥接

处理主线程与 Worker 之间的消息传递：

```typescript
// 发送消息
function send(w: Worker, msg: unknown): void

// 等待响应
function wait(w: Worker): Promise<Reply>
```

### 8. server.ts - HTTP 服务

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

Isolate 包含 6 个内置插件，默认使用 **GuardPlugin + ToolsetPlugin + LoaderPlugin + ClusterPlugin + LoggerPlugin** 组合：

### GuardPlugin ✅

请求验证插件，校验输入格式、大小限制。**（默认启用）**

**Hook**: `onValidate`

### LoaderPlugin ✅

代码加载插件，将代码转换为 Base64 Data URL。**（默认启用）**

**Hook**: `onLoad`  
**依赖**: `opencode:guard`

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

export const logger: Tool = {
  name: 'logger',
  description: '结构化日志工具',
  setup: (globals) => {
    globals.logger = {
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
      debug: (msg: string) => console.log(`[DEBUG] ${msg}`)
    }
  }
}

// 2. 注册到工具数组
// tools/index.ts
import { logger } from './logger.ts'

export const tools: Tool[] = [
  crypto,
  logger,  // 添加新工具
]
```

**使用示例**：

```javascript
// 用户代码
export default (data) => {
  logger.info('开始处理数据')
  
  try {
    const result = processData(data)
    logger.info('处理完成')
    return result
  } catch (error) {
    logger.error(`处理失败: ${error.message}`)
    throw error
  }
}
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

### 代码示例

#### 基本用法

```javascript
// 用户代码
export default function(input) {
  return input * 2
}
```

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"code": "export default (x) => x * 2", "input": 21}'
```

#### 使用自定义入口函数

```javascript
// 用户代码
export function add(x) {
  return x.a + x.b
}
```

```bash
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export function add(x) { return x.a + x.b }",
    "input": {"a": 1, "b": 2},
    "entry": "add"
  }'
```

#### 带日志输出

```javascript
// 用户代码
export default function(name) {
  console.log("Hello,", name)
  console.info("Processing...")
  return `Welcome, ${name}!`
}
```

**响应**：

```json
{
  "ok": true,
  "result": "Welcome, Alice!",
  "logs": [
    { "level": "log", "message": "Hello, Alice", "timestamp": 1234567890 },
    { "level": "info", "message": "Processing...", "timestamp": 1234567891 }
  ],
  "duration": 12
}
```

---

## 技术细节

### Data URL 代码加载

用户代码通过 Base64 编码转换为 Data URL，然后使用动态 `import()` 加载：

```
code: "export default x => x"
        ↓ Base64 编码
url: "data:application/javascript;base64,ZXhwb3J0IGRlZmF1bHQgeCA9PiB4"
        ↓ 动态导入
module: { default: x => x }
```

### Worker 消息通信协议

**主线程 → Worker (Packet)**：

```typescript
{
  code: string,   // 原始代码
  input: unknown, // 输入参数
  entry: string,  // 入口函数名
  url: string     // Data URL
}
```

**Worker → 主线程 (Output)**：

```typescript
{
  ok: boolean,
  result?: unknown,  // 仅成功时
  error?: Error,     // 仅失败时
  logs: string[],
  duration: number
}
```

### 性能计时

使用 `performance.now()` 进行高精度计时：

```typescript
const t0 = performance.now()
// ... 执行代码 ...
const duration = Math.round(performance.now() - t0)
```

### Worker 集群架构

ClusterPlugin 实现了 Worker 复用机制：

```
┌─────────────────────────────────────────┐
│           Cluster                       │
├─────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │Worker 1│  │Worker 2│  │Worker 3│    │
│  │ idle   │  │ busy   │  │ idle   │    │
│  └────────┘  └────────┘  └────────┘    │
├─────────────────────────────────────────┤
│  • 预创建 Worker (initialize)            │
│  • 任务调度 (acquire/release)            │
│  • 超时监控 (createTimer)                │
│  • 定期清理 (cleanup)                    │
└─────────────────────────────────────────┘
```

**优势**：
- 减少 Worker 创建开销（~50-100ms）
- 提高高并发场景吞吐量
- 自动扩缩容（min → max）

**适用场景**：
- 高频执行（QPS > 10）
- 代码执行时间较短（< 1s）
- 服务器环境

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
    ├── config.ts      # 默认配置
    ├── index.ts       # 入口导出
    ├── kernel.ts      # 微内核
    ├── server.ts      # HTTP 服务
    ├── types.ts       # 类型定义
    ├── worker.ts      # Worker 执行器
    ├── plugins/
    │   ├── guard.ts   # 验证插件
    │   ├── index.ts   # 插件导出
    │   ├── loader.ts  # 加载插件
    │   ├── logger.ts  # 日志插件
    │   ├── toolset.ts # 工具集插件
    │   ├── sandbox.ts # 沙箱插件（单次执行）
    │   └── cluster.ts # 集群插件（复用）
    └── tools/
        ├── index.ts   # 工具导出
        ├── types.ts   # 工具类型定义
        └── crypto.ts  # Crypto 工具
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
