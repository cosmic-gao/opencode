基于对 `packages/graph` 的分析，当前架构虽然基础扎实（微内核设计），但在核心模块（特别是 `GraphStore` 和 `Subgraph`）中存在**类膨胀**和**职责混合**的问题。

本方案旨在通过严格分离**存储（Registry）**、**逻辑（Applier/Analyzer）**和**状态（Store）**，来优化抽象颗粒度。

## 1. 状态层重构 (`src/state`)

目前 `GraphStore` 同时处理存储、索引和补丁应用逻辑。我们将把这些职责拆分。

### 1.1 提取 `GraphRegistry` (图注册表)
创建 `src/state/registry.ts`，负责所有底层数据存储和结构索引。
*   **职责**：维护 `nodeMap`, `edgeMap`, `endpointMap` 以及邻接表 (`incoming`/`outgoing`)。
*   **方法**：`registerNode`, `unregisterNode`, `registerEdge`, `unregisterEdge`, `getNode`, `getEdge` 等。
*   **收益**：从 `GraphStore` 中移除约 200 行的 Map 管理代码，使数据管理更加纯粹。

### 1.2 提取 `PatchApplier` (补丁应用器)
创建 `src/state/applier.ts`，封装补丁应用和回滚生成的逻辑。
*   **职责**：校验补丁一致性，针对 `GraphRegistry` 执行变更，并生成反向的 `UndoPatch`。
*   **方法**：`apply(patch): UndoPatch`。
*   **收益**：将复杂的“执行/回滚”逻辑与状态容器隔离。

### 1.3 重构 `GraphStore`
更新 `src/state/store.ts`，使其成为一个高层外观模式（Facade）。
*   **职责**：持有 `GraphRegistry` 实例，委托 `PatchApplier` 处理补丁，并提供公共 API。
*   **收益**：该类变为一个轻量级的协调者，易于阅读和测试。

## 2. 子图层重构 (`src/subgraph`)

目前的 `affected.ts` 使用函数组合，参数传递重复（`state`, `patch`, `options`, `semantics`）。

### 2.1 创建 `ImpactAnalyzer` 类 (影响分析器)
创建 `src/subgraph/analyzer.ts` 来封装影响分析上下文。
*   **职责**：存储分析配置（`ImpactOptions`, `ImpactSemantics`）并执行 BFS 遍历。
*   **API**：`constructor(state, options, semantics)`, `collectSeeds()`, `collectAffected()`, `analyze()`。
*   **收益**：减少参数透传，使分析生命周期有状态且更清晰。

### 2.2 优化 Impact Semantics (影响语义)
重构 `src/subgraph/semantics.ts`（或创建 `src/subgraph/strategy.ts`）。
*   **变更**：将种子收集逻辑中的 `if/else` 链替换为**策略模式**或基于 Map 的查找表，用于处理不同的补丁操作（`nodeAdd`, `edgeRemove` 等）。
*   **收益**：易于扩展新的补丁类型，无需修改核心逻辑。

## 3. 执行步骤

1.  **创建 `GraphRegistry`**：将 Map 管理和索引逻辑从 `Store` 迁移到 `Registry`。
2.  **创建 `PatchApplier`**：将 `apply`, `invert*`, `apply*` 方法从 `Store` 迁移到 `Applier`。
3.  **重构 `GraphStore`**：集成 `Registry` 和 `Applier` 到 `GraphStore` 中。
4.  **创建 `ImpactAnalyzer`**：实现基于类的影响分析方法。
5.  **重构 `Subgraph` 函数**：更新 `affected.ts` 内部使用 `ImpactAnalyzer`（保持向后兼容）或直接替换。
6.  **验证**：运行现有测试（隐含）或创建验证脚本，确保 `GraphStore` 行为无回归。
