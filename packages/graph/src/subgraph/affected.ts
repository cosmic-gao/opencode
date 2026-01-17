import type { GraphDelta } from '../delta'
import type { LookupView } from '../lookup/view'
import type { Edge } from '../model/edge'
import { Subgraph } from './instance'

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
 * - 新增边的两端节点
 * - 被移除边的两端节点
 *
 * @param lookup - 查表对象
 * @param delta - 变更描述
 * @returns 种子节点 ID 列表
 */
export function collectSeeds(
  lookup: LookupView,
  delta: GraphDelta,
): string[] {
  const seedNodeIds = new Set<string>()

  if (delta.removedNodeIds) {
    for (const nodeId of delta.removedNodeIds) seedNodeIds.add(nodeId)
  }

  if (delta.addedNodes) {
    for (const node of delta.addedNodes) seedNodeIds.add(node.id)
  }

  if (delta.addedEdges) {
    for (const edge of delta.addedEdges) {
      seedNodeIds.add(edge.source.nodeId)
      seedNodeIds.add(edge.target.nodeId)
    }
  }

  if (delta.removedEdgeIds) {
    for (const edgeId of delta.removedEdgeIds) {
      const edge = lookup.getEdge(edgeId)
      if (!edge) continue
      seedNodeIds.add(edge.source.nodeId)
      seedNodeIds.add(edge.target.nodeId)
    }
  }

  return [...seedNodeIds]
}

/**
 * 收集受影响的节点 ID 集合。
 *
 * 从种子节点开始，根据指定的方向和深度进行广度优先搜索 (BFS)。
 *
 * @param lookup - 查表对象
 * @param delta - 变更描述
 * @param options - 分析选项
 * @returns 受影响的节点 ID 集合
 */
export function collectAffected(
  lookup: LookupView,
  delta: GraphDelta,
  options: ImpactOptions = {},
): Set<string> {
  const { direction = 'both', depth: depthLimit, stopNodes, includeSeeds = true } = options
  const stopNodeIdSet = stopNodes ? new Set(stopNodes) : undefined

  const seeds = collectSeeds(lookup, delta)
  const visitedNodeIdSet = new Set<string>()
  const queue: Array<{ nodeId: string; depth: number }> = []

  for (const nodeId of seeds) {
    if (includeSeeds) visitedNodeIdSet.add(nodeId)
    queue.push({ nodeId, depth: 0 })
  }

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!
    if (stopNodeIdSet?.has(nodeId)) continue
    if (depthLimit !== undefined && depth >= depthLimit) continue

    if (direction === 'downstream' || direction === 'both') {
      processOutgoing(lookup.getNodeOutgoing(nodeId), visitedNodeIdSet, queue, depth)
    }

    if (direction === 'upstream' || direction === 'both') {
      processIncoming(lookup.getNodeIncoming(nodeId), visitedNodeIdSet, queue, depth)
    }
  }

  return visitedNodeIdSet
}

function processOutgoing(
  edges: Iterable<Edge>,
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

function processIncoming(
  edges: Iterable<Edge>,
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
 * @param lookup - 查表对象
 * @param coreNodeIds - 核心节点 ID 集合
 * @param options - 选项（仅 includeBoundary 生效）
 * @returns 子图实例
 */
export function createSubgraph(
  lookup: LookupView,
  coreNodeIds: ReadonlySet<string>,
  options: Pick<ImpactOptions, 'includeBoundary'> = {},
): Subgraph {
  const includeBoundary = options.includeBoundary === true
  const nodeIds = new Set<string>(coreNodeIds)
  const edgeIds = new Set<string>()

  for (const nodeId of coreNodeIds) {
    collectEdges(lookup.getNodeIncoming(nodeId), coreNodeIds, includeBoundary, edgeIds, nodeIds)
    collectEdges(lookup.getNodeOutgoing(nodeId), coreNodeIds, includeBoundary, edgeIds, nodeIds)
  }

  const nodes = [...nodeIds]
    .map((id) => lookup.getNode(id))
    .filter((node) => node !== undefined)
  const edges = [...edgeIds]
    .map((id) => lookup.getEdge(id))
    .filter((edge) => edge !== undefined)

  return new Subgraph({ nodes, edges, coreNodeIds: [...coreNodeIds] })
}

function collectEdges(
  edges: Iterable<Edge>,
  coreNodeIds: ReadonlySet<string>,
  includeBoundary: boolean,
  edgeIds: Set<string>,
  nodeIds: Set<string>,
) {
  for (const edge of edges) {
    if (includeBoundary) {
      // 如果包含边界边，则将边及其源节点也加入子图
      edgeIds.add(edge.id)
      nodeIds.add(edge.source.nodeId)
      nodeIds.add(edge.target.nodeId)
    } else if (coreNodeIds.has(edge.source.nodeId) && coreNodeIds.has(edge.target.nodeId)) {
      // 否则，只有当边的两端都在核心节点集合中时才包含该边
      edgeIds.add(edge.id)
    }
  }
}

/**
 * 计算受变更影响的子图。
 *
 * 这是分析变更影响范围的便捷入口函数。
 *
 * @param lookup - 查表对象
 * @param delta - 变更描述
 * @param options - 分析选项
 * @returns 受影响的子图
 */
export function affectedSubgraph(
  lookup: LookupView,
  delta: GraphDelta,
  options: ImpactOptions = {},
): Subgraph {
  const affectedNodeIds = collectAffected(lookup, delta, options)
  return createSubgraph(lookup, affectedNodeIds, options)
}
