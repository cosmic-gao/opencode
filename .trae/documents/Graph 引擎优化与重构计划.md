# 高性能 Graph 引擎优化方案 (精简核心版)

根据您的最新指示，我们将移除所有示例与兼容性代码，专注于构建纯净、高性能的核心引擎。

## 核心设计理念
1.  **纯净内核**：移除 `src/smoke.ts` 等示例文件及所有历史兼容性代码，保持代码库整洁。
2.  **统一抽象 (GraphSpec)**：使用 `GraphSpec` 作为图与子图的唯一基类。
3.  **详尽注释**：在核心类与方法中保留详细的原理性注释（用于学习），但移除冗余的示例代码块。

## 详细实施计划

### 1. 清理与重构 (Cleanup & Refactoring)
-   **移除冗余**：删除 `src/smoke.ts` 及任何非核心逻辑代码。
-   **引入 GraphSpec**：
    -   创建 `src/model/graph-definition.ts`。
    -   作为 `Graph` 和 `Subgraph` 的父类，承载 `nodes`, `edges` 及 `lookup()` 等核心逻辑。
    -   **注释**：详细解释类的职责与设计模式。

### 2. 核心实现 (Core Implementation)
-   **Graph 类**：
    -   继承 `GraphSpec`。
    -   优化构造函数，支持高效初始化。
-   **Subgraph 类**：
    -   继承 `GraphSpec`，使其成为“一等公民”，具备完整的图操作能力。
-   **Lookup 机制**：
    -   实现 `Lookup` 的状态复用，确保在 `GraphWorkspace` 转换过程中保持高性能。

### 3. 引擎增强 (Engine Enhancement)
-   **GraphWorkspace**：
    -   作为主要的批量操作入口，支持事务性的增删改。
    -   确保生成的图实例能直接复用增量计算结果。

## 执行步骤
1.  **清理**：删除示例文件。
2.  **基类实现**：创建 `GraphSpec`。
3.  **核心重构**：改造 `Graph`, `Subgraph`, `Lookup`。
4.  **验证**：确保核心逻辑正确，无冗余代码。
