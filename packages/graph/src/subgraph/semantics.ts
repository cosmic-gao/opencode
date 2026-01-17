import type { Edge } from '../model'
import type { GraphStore, Patch } from '../state'

/**
 * 影响语义插件 (ImpactSemantics)
 *
 * 用于定义“如何传播影响”的可插拔语义：
 * - 种子节点选择
 * - 上游/下游邻接边选择
 */
export interface ImpactSemantics {
  name: string
  getSeeds: (state: GraphStore, patch: Patch) => readonly string[]
  getOutgoing: (state: GraphStore, nodeId: string) => readonly Edge[]
  getIncoming: (state: GraphStore, nodeId: string) => readonly Edge[]
}

/**
 * 默认影响语义（与当前 analyzeImpact 行为一致）。
 *
 * @returns 影响语义插件
 */
export function createImpactSemantics(): ImpactSemantics {
  return {
    name: 'default',
    getSeeds: defaultSeeds,
    getOutgoing: defaultOutgoing,
    getIncoming: defaultIncoming,
  }
}

const DEFAULT_IMPACT_SEMANTICS = createImpactSemantics()

/**
 * 获取实际使用的影响语义。
 *
 * @param semantics - 可选的自定义语义
 * @returns 实际语义（自定义或默认）
 */
export function getImpactSemantics(semantics: ImpactSemantics | undefined): ImpactSemantics {
  return semantics ?? DEFAULT_IMPACT_SEMANTICS
}

function defaultOutgoing(state: GraphStore, nodeId: string): readonly Edge[] {
  return state.getNodeOutgoing(nodeId)
}

function defaultIncoming(state: GraphStore, nodeId: string): readonly Edge[] {
  return state.getNodeIncoming(nodeId)
}

function defaultSeeds(state: GraphStore, patch: Patch): readonly string[] {
  const seedNodeIds = new Set<string>()

  if (patch.nodeRemove) {
    for (const nodeId of patch.nodeRemove) seedNodeIds.add(nodeId)
  }

  if (patch.nodeAdd) {
    for (const node of patch.nodeAdd) seedNodeIds.add(node.id)
  }

  if (patch.nodeReplace) {
    for (const node of patch.nodeReplace) seedNodeIds.add(node.id)
  }

  if (patch.edgeAdd) {
    for (const edge of patch.edgeAdd) {
      seedNodeIds.add(edge.source.nodeId)
      seedNodeIds.add(edge.target.nodeId)
    }
  }

  if (patch.edgeReplace) {
    for (const edge of patch.edgeReplace) {
      seedNodeIds.add(edge.source.nodeId)
      seedNodeIds.add(edge.target.nodeId)
    }
  }

  if (patch.edgeRemove) {
    for (const edgeId of patch.edgeRemove) {
      const edge = state.getEdge(edgeId)
      if (!edge) continue
      seedNodeIds.add(edge.source.nodeId)
      seedNodeIds.add(edge.target.nodeId)
    }
  }

  return [...seedNodeIds]
}
