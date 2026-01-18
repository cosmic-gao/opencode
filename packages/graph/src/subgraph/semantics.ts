import type { Edge } from '../model'
import type { Store, Patch } from '../state'

/**
 * 影响语义插件 (Semantics)
 *
 * 用于定义“如何传播影响”的可插拔语义：
 * - 种子节点选择
 * - 上游/下游邻接边选择
 */
export interface Semantics {
  name: string
  seeds: (state: Store, patch: Patch) => readonly string[]
  outgoing: (state: Store, nodeId: string) => readonly Edge[]
  incoming: (state: Store, nodeId: string) => readonly Edge[]
}

/**
 * 默认影响语义。
 */
export function create(): Semantics {
  return {
    name: 'default',
    seeds: defaultSeeds,
    outgoing: defaultOutgoing,
    incoming: defaultIncoming,
  }
}

const DEFAULT = create()

/**
 * 获取实际使用的影响语义。
 *
 * @param semantics - 可选的自定义语义
 * @returns 实际语义（自定义或默认）
 */
export function resolve(semantics: Semantics | undefined): Semantics {
  return semantics ?? DEFAULT
}

function defaultOutgoing(state: Store, nodeId: string): readonly Edge[] {
  return state.outgoing(nodeId)
}

function defaultIncoming(state: Store, nodeId: string): readonly Edge[] {
  return state.incoming(nodeId)
}

type SeedCollector = (patch: Patch, state: Store, seeds: Set<string>) => void

const collectors: SeedCollector[] = [
  (p, _, s) => p.nodeRemove?.forEach((id) => s.add(id)),
  (p, _, s) => p.nodeAdd?.forEach((n) => s.add(n.id)),
  (p, _, s) => p.nodeReplace?.forEach((n) => s.add(n.id)),
  (p, _, s) => {
    p.edgeAdd?.forEach((e) => {
      s.add(e.source.nodeId)
      s.add(e.target.nodeId)
    })
  },
  (p, _, s) => {
    p.edgeReplace?.forEach((e) => {
      s.add(e.source.nodeId)
      s.add(e.target.nodeId)
    })
  },
  (p, state, s) => {
    p.edgeRemove?.forEach((id) => {
      const edge = state.getEdge(id)
      if (edge) {
        s.add(edge.source.nodeId)
        s.add(edge.target.nodeId)
      }
    })
  },
]

function defaultSeeds(state: Store, patch: Patch): readonly string[] {
  const seeds = new Set<string>()
  for (const collector of collectors) {
    collector(patch, state, seeds)
  }
  return [...seeds]
}

