## 目标
- 将当前硬编码的影响传播语义（种子选择 + 邻接遍历 + 子图构建边选择）抽象为可插拔插件。
- 保持默认行为不变：不传插件时仍是“按 Patch 变更点作为 seeds，按图边 upstream/downstream BFS 传播”。

## 设计（微内核 + 插件）
- 新增 **ImpactSemantics**（插件接口，≤2 词命名）
  - `name: string`
  - `getSeeds(state, patch): readonly string[]`
  - `getOutgoing(state, nodeId): readonly Edge[]`
  - `getIncoming(state, nodeId): readonly Edge[]`
  - 语义说明：分析与子图构建都只使用该接口提供的边与 seeds，保证“传播与输出一致”。

## API 调整（兼容现有调用）
- 保留现有导出函数名，但新增可选参数：
  - `analyzeImpact(state, patch, options?, semantics?)`
  - `collectSeeds(state, patch, semantics?)`
  - `collectAffected(state, patch, options?, semantics?)`
  - `createSubgraph(state, coreNodeIds, options?, semantics?)`
- 提供默认实现：`DEFAULT_IMPACT_SEMANTICS`（或 `createImpactSemantics()` 返回默认实例）。

## 默认语义实现（行为与当前一致）
- `getSeeds`：沿用现有规则
  - `patch.nodeRemove`、`patch.nodeAdd`、`patch.edgeAdd`、`patch.edgeReplace` 两端节点
  - `patch.edgeRemove`：用 `state.getEdge(edgeId)` 找到两端节点
- `getOutgoing/getIncoming`：直接调用 `state.getNodeOutgoing/getNodeIncoming`。

## 示例增强（展示“可插拔”）
- 新增示例 `examples/custom-impact.ts`
  - 自定义 semantics：例如只传播 `edge.metadata?.impact === true` 的边（getOutgoing/getIncoming 内过滤）
  - 输出对比：默认语义 vs 自定义语义的 impacted nodes/subgraph。

## 测试与验证
- 新增 `packages/graph/tests/impact.test.ts`
  - 构造包含“可传播边/不可传播边”的图
  - 对比默认语义与自定义语义的结果集合不同且符合预期
- 验证：
  - `pnpm -w exec tsc -p packages/graph/tsconfig.json --noEmit`
  - `pnpm -w dlx tsx packages/graph/tests/impact.test.ts`

## 规范约束（AGENTS.md）
- 所有新增对外导出函数与插件接口/工厂函数补齐 JSDoc（意图、约束、边界、失败模式、示例）。
- 所有 import 优先从目录 `index.ts` 聚合导入（如 `../model`、`../state`）。
- 命名控制在 1–2 个词，避免 `handle/process/do` 等模糊动词。