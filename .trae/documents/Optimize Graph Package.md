## 目标（工程最优 + 未来可通过继承扩展）
- Graph 核心保持“声明式模型”：只表达结构/连接/契约。
- 性能优化：高频查询复用索引、校验去噪且减少分配。
- 未来扩展方式：通过继承扩展 Graph（例如 DAG 能力），因此核心类需提供可覆盖的扩展点。

## 1) 重命名并增强索引层：Index -> Lookup
- 将 class `Index` 重命名为 `Lookup`（单词命名，语义更贴近“查表/索引”）。
- 同步目录与导出：`src/index/index.ts` -> `src/lookup/lookup.ts`，入口 `src/index.ts` 更新导出。
- `Graph.index()` 改为 `Graph.lookup()`。

## 2) Lookup 增强（为校验与未来扩展提供基础）
- 新增 O(1) 能力（少分配/不分配）：
  - `hasNode/hasEdge/hasEndpoint`
  - `incomingSize(inputId)` / `outgoingSize(outputId)`
  - `incomingIds(inputId)` / `outgoingIds(outputId)`（只读 id 列表/迭代器）
  - `nodeId(endpointId)`、`endpoints(nodeId)`
- 邻接结构从 `Set<string>` 改为 `string[]`（保序、少内存、遍历快）。

## 3) Graph 统一走 Lookup（消除线性扫描）
- Graph 内部惰性创建并缓存 `Lookup`，作为默认查询路径。
- 将 `getNode/getEdge/getEndpoint` 改为基于缓存 Lookup 的 Map 查询。
- （推荐）对 `nodes/edges/inputs/outputs` 做防御性复制并冻结数组，为缓存一致性提供前提。

## 4) 为继承预留扩展点（不引入拓扑分析层）
- 在 `Graph` 中新增可覆盖的受保护方法（动词+名词命名）：
  - `protected createLookup(): Lookup`：默认返回 `new Lookup(this)`；子类可覆盖以构建增强版 Lookup。
  - `protected createRules(options): Rule[]`：默认返回当前默认规则；子类可覆盖以追加规则（例如 DAG/无环约束）。
- 缓存字段使用 `protected`（避免 `#private`），让子类可以复用或调整缓存策略。

## 5) validate 去噪 + 去分配（保持 Rule 扩展点）
- validate 默认复用 `graph.lookup()` 的缓存 Lookup。
- 默认规则实现优化：
  - 引用缺失时只输出 reference，不再继续 direction/flow/ownership 的派生诊断。
  - cardinality 使用 `incomingSize`。
  - flow 仅在两端存在且方向合法时校验。
- Rule 接口签名更新为 `evaluate(graph, lookup)`。

## 6) 文档与验证
- 更新 [ARCHITECTURE.md]：将 Index 替换为 Lookup，补充 Lookup API、Graph 缓存策略、以及“通过继承扩展 Graph”的推荐方式与示例（只展示覆盖 createLookup/createRules 的骨架）。
- 运行 `tsc --noEmit`（graph 包）确保类型检查通过。
- 增加一个最小 smoke 示例：构建小图 + `lookup()` 查询 + `validate()` 输出，覆盖新 API。