## 缺陷复核（与现有实现一一对应）
- **Graph 非真相源**：当前 `GraphWorkspace.apply` 在索引更新后用 `Lookup.fromSnapshot(this.lookup.getSnapshot())` 反构 `tempGraph`，Graph 语义依赖索引正确性，[workspace/index.ts](file:///e:/opencode/packages/graph/src/workspace/index.ts#L96-L103)。
- **回滚不安全**：数组回滚与索引 undo 都依赖 `invertDelta` 的逻辑反演，而其实现明确依赖“在 apply 前计算/lookup 可查询旧对象”，并会在不满足时降级与告警，[delta/invert.ts](file:///e:/opencode/packages/graph/src/delta/invert.ts#L14-L64)。
- **apply 膨胀**：normalize、undo、索引、数组、graph 构造、validate、impact、事务控制都耦合在 [GraphWorkspace.apply](file:///e:/opencode/packages/graph/src/workspace/index.ts#L62-L132)。
- **validate 语义依赖 lookup**：规则契约为 `evaluate(graph, lookup)`，规则读 `LookupView`，导致图本体无法独立验证，[validate.ts](file:///e:/opencode/packages/graph/src/validate/validate.ts#L20-L41)。
- **影响分析绑在 apply 内**：apply 内直接 `collectAffected/createSubgraph` 且依赖 lookup 状态，[workspace/index.ts](file:///e:/opencode/packages/graph/src/workspace/index.ts#L93-L120)。
- **Delta 表达受限**：`GraphDelta` 仅 add/remove，且 add/remove 都是 no-op 语义（不 replace、不 update），[delta/index.ts](file:///e:/opencode/packages/graph/src/delta/index.ts#L1-L37)。
- **快照不可变性隐患**：lookup snapshot/装载以浅拷贝为主，存在共享可变引用风险，[lookup/incremental.ts](file:///e:/opencode/packages/graph/src/lookup/incremental.ts#L70-L91)，[lookup/index.ts](file:///e:/opencode/packages/graph/src/lookup/index.ts#L88-L110)。

## 约束（严格遵守 packages/graph/AGENTS.md）
- 模块化、高内聚低耦合、微内核：核心稳定，能力可插拔。
- 命名：完整英文单词；1 个词优先、最多 2 个词；禁止无语义名与模糊动词。
- 代码约束：单一职责、≤50 行/函数、≤3 层嵌套、显式边界与异常、严格类型。
- 核心方法（export/入口/副作用）必须写 JSDoc：意图、约束、边界、失败模式、@param/@returns/@throws/@example。

## 新架构（一次性切换，不保留兼容层）
### 1) GraphState：唯一事实源（核心内核）
- 负责：nodes/edges 的权威存储与不变量维护。
- 提供：
  - `applyPatch(patch: GraphPatch): GraphState`
  - `createSnapshot(): GraphSnapshot` / `restoreSnapshot(snapshot: GraphSnapshot): GraphState`
- 设计要求：snapshot 必须是“可证明不可变”的结构（不可被后续 mutation 污染）。

### 2) GraphIndex：派生缓存（可插拔）
- `GraphIndex` 接口仅依赖 `GraphState` 与 `GraphPatch`：
  - `create(state)` 全量构建
  - `applyPatch(patch)` 增量更新（保留 O(Δ)）
  - `createSnapshot()/restoreSnapshot()` 支持事务
- 现有 `IncrementalLookup` 改为实现 `GraphIndex`（并移除 `invertDelta` undo 栈）。

### 3) GraphValidator / GraphAnalyzer：纯能力插件（微内核）
- `GraphValidator.validate(state, patch?): Diagnostic[]`：默认只读 GraphState；如果需要性能加速，通过显式注入的 index 读取（非必需语义）。
- `GraphAnalyzer.analyze(state, patch, options): Subgraph`：影响分析完全从事务生命周期移出。

### 4) GraphTransaction：事务对象（快照回滚）
- begin 捕获：GraphState snapshot + GraphIndex snapshot。
- apply：先对 GraphState 生成新快照，再派生更新 GraphIndex。
- validate：失败则 rollback（restore 两个 snapshot），保证无幽灵状态。
- commit：原子替换 Workspace 状态。

## 友好 API（新入口，替换现有 apply）
### 设计目标
- 调用者无需理解 patch/delta 细节即可表达“意图”。
- 事务边界显式且易用；失败模式明确。

### 公共 API 形态（建议）
- `GraphWorkspace.update(updater: (transaction: GraphTransaction) => void, options?): GraphResult`
  - updater 内通过强类型方法表达意图：
    - `createNode(node)` / `removeNode(nodeId)`
    - `createEdge(edge)` / `removeEdge(edgeId)`
    - `replaceNode(node)` / `replaceEdge(edge)`
  - `update` 内部自动 begin/commit/rollback；返回 `{graph, patch, diagnostics}`。
- 提供低层入口（高级用户）：`GraphWorkspace.applyPatch(patch)`（仍走事务与校验）。

## 变更模型（替换旧 GraphDelta）
- `GraphCommand`（意图层）：由 transaction 的方法直接收集，不对外暴露为复杂 AST。
- `GraphPatch`（事实层）：支持 add/remove + replace（至少 Node/Edge replace）。
- 删除 `GraphDelta` 作为对外类型与入口，不做任何兼容。

## 代码改造落点（按目录）
- `src/workspace/`：重写 Workspace（移除 apply 巨函数；引入 update/applyPatch；只做协调）。
- `src/state/`（新增）：GraphState/GraphSnapshot/GraphPatch。
- `src/index/` 或 `src/lookup/`：把 IncrementalLookup 调整为 GraphIndex 实现；事务改 snapshot restore。
- `src/validate/`：规则接口改为 GraphState-only；必要的查询能力下沉到 GraphState（而非隐式 lookup）。
- `src/subgraph/`：影响分析改为 `analyze(graphState, patch, options)`，不再在事务内自动触发。
- `examples/`：全部按新 API 更新。

## 验收标准（必须满足才算完成）
- 事务安全：任何校验失败或异常都能恢复到 begin 前状态（GraphState + Index 一致）。
- 真相源单一：GraphState 不依赖 Index 反构；Index 永远是派生。
- API 友好：常见编辑场景只需 `workspace.update(...)`，不需要手写 patch。
- 规范合规：所有 export/入口/副作用方法有完整 JSDoc；命名不超过 2 个词且无缩写；函数长度/嵌套满足 AGENTS.md。

确认该计划后，我将直接按以上“无兼容层”的目标实现全量切换，并用新增的事务一致性测试覆盖关键失败模式（包含 rollback、嵌套更新、replace 覆盖语义）。