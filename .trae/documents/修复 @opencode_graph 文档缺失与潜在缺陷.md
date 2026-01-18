# 修复 @opencode/graph 文档缺失与潜在缺陷

基于对 `@opencode/graph` 的深度分析，项目架构清晰且符合微内核设计，但在代码规范（注释）和部分实现细节上存在缺陷。本计划旨在修复这些问题以符合用户规范。

## 架构分析总结
- **架构设计**：采用微内核架构 (`model` + `state` + `validate` + `lookup`)，依赖方向正确，职责边界清晰。
- **规范遵循**：
  - 命名规范：整体良好，但在 `Store` 等核心类中存在大量导出方法缺少 JSDoc 的严重违规。
  - 代码约束：逻辑复杂度控制得当，无明显过长函数或深层嵌套。
- **潜在缺陷**：
  - `Registry.removeEdgeRef` 使用了 Swap-Remove（交换移除）策略，导致边列表顺序不稳定（非确定性），可能影响 UI 展示或调试稳定性。

## 实施计划

### 1. 补全核心方法注释 (JSDoc)
根据“核心方法注释（强制）”规则，为以下类的公共方法添加完整的 JSDoc (`@param`, `@returns`, `@throws`)：
- **`src/state/store.ts`**:
  - `getNode`, `getEdge`, `getEndpoint`, `hasNode`, `hasEdge`, `endpoints`, `outgoing`, `incoming` 等查询方法。
- **`src/state/registry.ts`**:
  - `addNode`, `replaceNode`, `removeNode`, `addEdge`, `replaceEdge`, `removeEdge` 等索引维护方法。
- **`src/state/applier.ts`**:
  - `apply` 方法（需详细说明回滚机制）。

### 2. 修复边列表顺序不稳定性
将 `Registry.removeEdgeRef` 的实现从“交换移除”改为“稳定移除” (`splice`)，确保 `outgoing/incoming` 边列表的顺序在删除操作后保持稳定。

### 3. 验证
- 运行 `npm run typecheck` 确保类型与注释无语法错误。
- 确认修改未破坏现有逻辑（通过静态检查）。
