基于对 `packages/graph` 的架构分析，我将执行以下计划以补充缺失的示例并完善文档：

### 1. 完善核心文档 (JSDoc)
- **目标文件**: `src/workspace/index.ts`
- **操作**: 为 `GraphWorkspace` 类及其核心方法 `apply` 添加符合规范的 `@example` 注释。展示如何初始化工作区、应用变更以及获取新快照。

### 2. 创建独立示例库
- **新建目录**: `packages/graph/examples/`
- **新建文件**:
    - `basic-usage.ts`: 一个完整的可运行脚本，演示以下流程：
        1. 定义初始图结构 (`GraphSpec`)。
        2. 初始化 `GraphWorkspace`。
        3. 构造并应用 `GraphDelta`（添加节点/边）。
        4. 执行 `validate()` 校验图的完整性。
        5. 使用 `affectedSubgraph` 分析受影响范围。
    - `README.md`: 简要说明示例的运行方式和场景。

> **注意**: 分析发现该包目前完全缺失测试框架（`package.json` 中无 `vitest`/`jest`）。虽然本次任务仅聚焦于“增加示例”，但强烈建议后续补充单元测试以保障架构稳定性。
