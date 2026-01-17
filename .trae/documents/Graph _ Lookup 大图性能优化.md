## 目标
- 面向大图编辑：不扫描整个 Graph。
- 支持“脏区域传播（Dirty Propagation）”的受影响子图查询 API（Upstream/Downstream、多路径、有环可终止）。
- 新增 `Subgraph` 类作为返回类型，为未来继承扩展预留。
- 允许必要的局部重构，但避免一次性大重写。

## 交付范围（精简且可落地）

## 1) 提取变更集：新增 GraphDelta
- 新增 `GraphDelta`（值类型），仅覆盖编辑器最常见操作：
  - `addedNodes: Node[]`
  - `removedNodeIds: string[]`
  - `addedEdges: Edge[]`
  - `removedEdgeIds: string[]`
  - （可选）`updatedNodes/updatedEdges` 先用“remove+add”语义替代，保持实现简单

## 2) 局部重构 Lookup：抽出邻接构建与节点级邻接查询
- 在现有 `Lookup` 基础上做局部重构（拆函数/拆 Map），目标是：
  - 能在 O(1) 时间拿到：
    - 某 node 的入/出边（node 级邻接）
    - 某 endpoint 的入/出边（endpoint 级邻接）
  - 并提供一个最小接口 `LookupView`（只读查询面），未来可由增量索引实现同接口。

## 3) 新增 IncrementalLookup（只做增量维护的索引）
- 新增 `IncrementalLookup implements LookupView`，内部结构与 Lookup 类似，但提供：
  - `apply(delta: GraphDelta)`：只更新 delta 涉及的 nodes/edges/endpoint 邻接
- 删除节点场景的关键点：
  - 通过 node 的 endpoints + endpoint 邻接直接取出所有 incident edges（不扫全图）
  - 更新相关邻接与映射表

## 4) 新增 Subgraph 类 + 受影响子图 API（核心）
- 新增 `Subgraph extends Graph`（仅作为语义类型 + 可序列化快照）。
- 新增 `affectedSubgraph(lookup: LookupView, delta: GraphDelta, options)`：
  - 脏源：delta 触达的 nodeIds + delta 触达 edge 两端所属 node
  - 扩散：按 `direction: upstream|downstream|both` + `depth?` BFS/DFS，visited 去重支持多路径与有环
  - 输出：`Subgraph`（节点集合 + 内部边；可选 includeBoundaryEdges）

## 5) 新增 GraphWorkspace（编辑会话层）
- 新增 `GraphWorkspace`：持有 `graph` + `lookup(IncrementalLookup)`。
- `apply(delta)` 返回：
  - 新的 graph 快照（只更新 delta 涉及的数组，不做全量重建）
  - 更新后的增量 lookup
  - `affected: Subgraph`
- 为未来扩展：Workspace 允许注入规则/策略，但这次先只交付“受影响子图”。

## 6) 轻量验证（不做大 benchmark）
- 增加一个 smoke：构建多路径图与有环图，分别验证：
  - 删除节点时 affectedSubgraph 覆盖上下游依赖
  - 新增边/节点时 affectedSubgraph 仅触达邻接扩散区域
- 运行 `tsc --noEmit`。

## 7) 文档补充（教学文档追加一节即可）
- 在 `ARCHITECTURE.md` 增加“增量化编辑与脏区域传播”章节：
  - GraphDelta 的含义
  - affectedSubgraph 的语义（多路径/有环）
  - 删除/新增节点的局部访问路径（不扫描全图）

确认后我会按上述顺序实现：先最小重构 Lookup 的查询面，再落地 IncrementalLookup/affectedSubgraph/Workspace，最后补 smoke 与文档。