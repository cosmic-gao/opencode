import type { GraphStore, Patch } from '../state'
import { Subgraph } from './instance'
import { getImpactSemantics, type ImpactSemantics } from './semantics'

/**
 * 影响传播方向
 * - upstream: 向上游传播（反向追踪依赖）
 * - downstream: 向下游传播（正向追踪影响）
 * - both: 双向传播
 */
export type Direction = 'upstream' | 'downstream' | 'both'

/**
 * 受影响子图分析选项
 */
export interface ImpactOptions {
  /** 传播方向 (默认为 both) */
  direction?: Direction
  /** 传播深度限制 (默认不限制) */
  depth?: number
  /** 是否包含边界边（连接子图内部节点与外部节点的边，默认为 false） */
  includeBoundary?: boolean
  /** 停止传播的节点 ID 列表（屏障节点） */
  stopNodes?: readonly string[]
  /** 是否包含种子节点本身 (默认为 true) */
  includeSeeds?: boolean
}

/**
 * 收集变更的种子节点 ID。
 *
 * 种子节点是受变更直接影响的节点，包括：
 * - 被移除的节点
 * - 新增节点
 * - 替换节点
 * - 新增边的两端节点
 * - 替换边的两端节点
 * - 被移除边的两端节点
 *
 * @param state - 图状态
 * @param patch - 事实补丁
 * @param semantics - 可选的影响语义插件
 * @returns 种子节点 ID 列表
 */
export function collectSeeds(
  state: GraphStore,
  patch: Patch,
  semantics?: ImpactSemantics,
): string[] {
  return [...getImpactSemantics(semantics).getSeeds(state, patch)]
}

/**
 * 收集受影响的节点 ID 集合。
 *
 * 从种子节点开始，根据指定的方向和深度进行广度优先搜索 (BFS)。
 *
 * @param state - 图状态
 * @param patch - 事实补丁
 * @param options - 分析选项
 * @param semantics - 可选的影响语义插件
 * @returns 受影响的节点 ID 集合
 */
export function collectAffected(
  state: GraphStore,
  patch: Patch,
  options: ImpactOptions = {},
  semantics?: ImpactSemantics,
): Set<string> {
  const { direction = 'both', depth: depthLimit, stopNodes, includeSeeds = true } = options
  const stopNodeIdSet = stopNodes ? new Set(stopNodes) : undefined

  const impactSemantics = getImpactSemantics(semantics)
  const seeds = impactSemantics.getSeeds(state, patch)
  const visitedNodeIdSet = new Set<string>()
  const queue: Array<{ nodeId: string; depth: number }> = []

  for (const nodeId of seeds) {
    if (includeSeeds) visitedNodeIdSet.add(nodeId)
    queue.push({ nodeId, depth: 0 })
  }

  for (let index = 0; index < queue.length; index++) {
    const item = queue[index]
    if (!item) continue
    const { nodeId, depth } = item
    if (stopNodeIdSet?.has(nodeId)) continue
    if (depthLimit !== undefined && depth >= depthLimit) continue

    if (direction === 'downstream' || direction === 'both') {
      visitOutgoing(impactSemantics.getOutgoing(state, nodeId), visitedNodeIdSet, queue, depth)
    }

    if (direction === 'upstream' || direction === 'both') {
      visitIncoming(impactSemantics.getIncoming(state, nodeId), visitedNodeIdSet, queue, depth)
    }
  }

  return visitedNodeIdSet
}

function visitOutgoing(
  edges: readonly { source: { nodeId: string }; target: { nodeId: string } }[],
  visited: Set<string>,
  queue: Array<{ nodeId: string; depth: number }>,
  depth: number,
) {
  for (const edge of edges) {
    const nextNodeId = edge.target.nodeId
    if (visited.has(nextNodeId)) continue
    visited.add(nextNodeId)
    queue.push({ nodeId: nextNodeId, depth: depth + 1 })
  }
}

function visitIncoming(
  edges: readonly { source: { nodeId: string }; target: { nodeId: string } }[],
  visited: Set<string>,
  queue: Array<{ nodeId: string; depth: number }>,
  depth: number,
) {
  for (const edge of edges) {
    const nextNodeId = edge.source.nodeId
    if (visited.has(nextNodeId)) continue
    visited.add(nextNodeId)
    queue.push({ nodeId: nextNodeId, depth: depth + 1 })
  }
}

/**
 * 根据节点 ID 集合创建子图。
 *
 * @param state - 图状态
 * @param coreNodeIds - 核心节点 ID 集合
 * @param options - 选项（仅 includeBoundary 生效）
 * @param semantics - 可选的影响语义插件
 * @returns 子图实例
 */
export function createSubgraph(
  state: GraphStore,
  coreNodeIds: ReadonlySet<string>,
  options: Pick<ImpactOptions, 'includeBoundary'> = {},
  semantics?: ImpactSemantics,
): Subgraph {
  const includeBoundary = options.includeBoundary === true
  const nodeIds = new Set<string>(coreNodeIds)
  const edgeIds = new Set<string>()
  const impactSemantics = getImpactSemantics(semantics)

  for (const nodeId of coreNodeIds) {
    collectEdges(impactSemantics.getIncoming(state, nodeId), coreNodeIds, includeBoundary, edgeIds, nodeIds)
    collectEdges(impactSemantics.getOutgoing(state, nodeId), coreNodeIds, includeBoundary, edgeIds, nodeIds)
  }

  const nodes = [...nodeIds]
    .map((id) => state.getNode(id))
    .filter((node) => node !== undefined)
  const edges = [...edgeIds]
    .map((id) => state.getEdge(id))
    .filter((edge) => edge !== undefined)

  return new Subgraph({ nodes, edges, coreNodeIds: [...coreNodeIds] })
}

function collectEdges(
  edges: readonly { id: string; source: { nodeId: string }; target: { nodeId: string } }[],
  coreNodeIds: ReadonlySet<string>,
  includeBoundary: boolean,
  edgeIds: Set<string>,
  nodeIds: Set<string>,
) {
  for (const edge of edges) {
    if (includeBoundary) {
      edgeIds.add(edge.id)
      nodeIds.add(edge.source.nodeId)
      nodeIds.add(edge.target.nodeId)
    } else if (coreNodeIds.has(edge.source.nodeId) && coreNodeIds.has(edge.target.nodeId)) {
      edgeIds.add(edge.id)
    }
  }
}

/**
 * 分析变更影响范围。
 *
 * @param state - 图状态
 * @param patch - 事实补丁
 * @param options - 分析选项
 * @param semantics - 可选的影响语义插件
 * @returns 受影响子图
 */
export function analyzeImpact(
  state: GraphStore,
  patch: Patch,
  options: ImpactOptions = {},
  semantics?: ImpactSemantics,
): Subgraph {
  const affectedNodeIds = collectAffected(state, patch, options, semantics)
  return createSubgraph(state, affectedNodeIds, options, semantics)
}
