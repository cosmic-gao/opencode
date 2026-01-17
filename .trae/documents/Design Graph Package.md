## 目标与边界
- 在 `packages/graph` 新增一个**独立**的 Graph 编排模型库。
- Graph 只描述 **“是什么”**（结构、连接、契约），不包含任何调度/执行/运行逻辑。
- 核心模型使用 **class** 表达，且 **class 名称优先单词**（Node/Graph/Edge/Endpoint/Input/Output 等）。

## 领域模型（全部 class 单词命名）
- `Graph`：
  - 字段：`nodes: Node[]`、`edges: Edge[]`、`metadata?: Record<string, unknown>`。
  - 方法：`getNode(id)`、`getEdge(id)`、`getEndpoint(id)`（只读查询）。
  - 方法：`index()` 返回 `Index`（构建只读索引以提升性能）。
  - 方法：`toJSON()` / `static fromJSON()`（序列化/反序列化，适配存储与 UI）。
- `Node`：
  - 字段：`id`、`type`、`name?`、`inputs: Input[]`、`outputs: Output[]`、`metadata?`。
- `Endpoint`：
  - 基类字段：`id`、`name`、`contract: Contract`、`metadata?`。
- `Input` / `Output`：继承 `Endpoint`。
- `Edge`：
  - 字段：`id`、`from: Reference`（必须指向 Output）、`to: Reference`（必须指向 Input）、`metadata?`。
- `Reference`：
  - 字段：`nodeId: string`、`endpointId: string`（显式引用，避免 name 歧义）。
- `Contract`：
  - 字段：`flow: 'data' | 'control' | string`、`schema?: unknown`（Graph 不解释 schema）。

## 性能设计（Index）
- `Index`（class）：
  - 由 `graph.index()` 构建，内部维护 `Map/Set`：
    - `nodeById`、`endpointById`、`edgeById`
    - `endpointsByNodeId`
    - `incomingEdgesByInputId`、`outgoingEdgesByOutputId`
  - 方法：`incoming(inputId)`、`outgoing(outputId)`、`endpoints(nodeId)` 等 O(1) 查询。

## 一致性校验（诊断与规则）
- `Diagnostic`（class 或 type）：`level/code/message/target`，可直接用于 UI 展示。
- `Rule`（接口/类型）：`evaluate(graph: Graph, index: Index): Diagnostic[]`。
- `validate(graph, options?)`（函数）或 `graph.validate(options?)`（方法）：
  - 默认规则（只校验“描述一致性”）：
    - Edge 两端引用存在
    - 方向合法：Output → Input
    - Endpoint 归属合法
    - Input 入边策略（默认最多 1 条，可配置放宽）
    - 契约兼容（可选，由规则决定）
  - 支持注入自定义 `Rule[]` 扩展。

## 包结构（packages/graph）
- `package.json`：`@opencode/graph`，`type: module`，入口 `src/index.ts`
- `tsconfig.json`：继承 `@opencode/tsconfig/esm.json`
- `src/model/*.ts`：Graph/Node/Endpoint/Input/Output/Edge/Reference/Contract
- `src/index/*.ts`：Index
- `src/validate/*.ts`：Diagnostic/Rule/validate + 默认规则
- `ARCHITECTURE.md`：概念、约束、失败模式、示例（核心方法按 JSDoc 写清契约）

## 验证方式
- 新包创建后执行 TypeScript 类型检查（`tsc --noEmit`）确保无类型错误。
- 文档示例覆盖：创建 Graph、连接端点、构建 Index、产出 Diagnostic。