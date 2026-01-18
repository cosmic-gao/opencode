我将针对 `packages/graph/src` 目录下的代码进行全方位重构，重点优化命名规范（严格控制在 1-2 个单词）、简化 API 设计以及拆分大文件。

## 1. 命名与 API 优化 (重命名策略)

我将系统性地重命名类、方法和属性，确保符合“绝不超过 2 个单词”的要求。

### 状态层 (`src/state`)
*   **类名**:
    *   `GraphRegistry` → `Registry`
    *   `GraphStore` → `Store`
    *   `PatchApplier` → `Applier`
*   **方法名** (Registry/Store):
    *   `getEndpointNodeId` → `owner`
    *   `getNodeEndpoints` → `endpoints`
    *   `getNodeOutgoing` → `outgoing`
    *   `getNodeIncoming` → `incoming`
    *   `getIncomingEdges` → `inputEdges`
    *   `getOutgoingEdges` → `outputEdges`
    *   `applyPatch` → `apply`

### 子图层 (`src/subgraph`)
*   **类名**:
    *   `ImpactAnalyzer` → `Analyzer`
    *   `ImpactSemantics` → `Semantics`
*   **方法名**:
    *   `collectSeeds` → `seeds`
    *   `collectAffected` → `affected`
    *   `createSubgraph` → `build`
    *   `analyzeImpact` → `analyze`
    *   `getImpactSemantics` → `resolve`

### 工作区层 (`src/workspace`)
*   **类名**: `GraphWorkspace` → `Workspace`
*   **方法名**:
    *   `throwIfInvalid` → `assert`
    *   `applyPatch` → `apply`

## 2. 结构重构 (文件拆分)

### 校验层 (`src/validate`)
*   **拆分**: 将 `validate.ts` (410 行) 拆分为：
    *   `src/validate/validator.ts`: 核心校验逻辑 (`validate`, `validateAll`)。
    *   `src/validate/rules/`: 规则目录，按职责拆分。
        *   `identity.ts`, `reference.ts`, `flow.ts` 等。
*   **API**: 将 `validate(state, patch)` 简化为 `check(state, patch)`。

## 3. 执行顺序

1.  **重构 `validate`**: 拆分文件并简化 API。
2.  **重构 `state`**: 重命名类并简化方法名。
3.  **重构 `subgraph`**: 重命名类与函数。
4.  **重构 `workspace`**: 重命名类与方法。
5.  **更新导出**: 确保各模块 `index.ts` 导出新的命名。

该计划完全覆盖了您的要求：严格的命名约束、API 优化以及结构清晰度提升。
