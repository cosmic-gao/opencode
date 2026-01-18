import type { Store, Patch } from '../state'
import { Subgraph } from './instance'
import { resolve, type Semantics } from './semantics'

export type Direction = 'upstream' | 'downstream' | 'both'

export interface Options {
  direction?: Direction
  depth?: number
  includeBoundary?: boolean
  stopNodes?: readonly string[]
  includeSeeds?: boolean
}

export class Analyzer {
  private readonly semantics: Semantics

  constructor(
    private readonly state: Store,
    private readonly options: Options = {},
    semantics?: Semantics,
  ) {
    this.semantics = resolve(semantics)
  }

  seeds(patch: Patch): string[] {
    return [...this.semantics.seeds(this.state, patch)]
  }

  affected(patch: Patch): Set<string> {
    const { direction = 'both', depth: depthLimit, stopNodes, includeSeeds = true } = this.options
    const stopNodeIdSet = stopNodes ? new Set(stopNodes) : undefined

    const seeds = this.seeds(patch)
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
        this.visitOutgoing(nodeId, visitedNodeIdSet, queue, depth)
      }

      if (direction === 'upstream' || direction === 'both') {
        this.visitIncoming(nodeId, visitedNodeIdSet, queue, depth)
      }
    }

    return visitedNodeIdSet
  }

  analyze(patch: Patch): Subgraph {
    const affectedNodeIds = this.affected(patch)
    return this.build(affectedNodeIds)
  }

  build(coreNodeIds: ReadonlySet<string>): Subgraph {
    const includeBoundary = this.options.includeBoundary === true
    const nodeIds = new Set<string>(coreNodeIds)
    const edgeIds = new Set<string>()

    for (const nodeId of coreNodeIds) {
      this.collectEdges(this.semantics.incoming(this.state, nodeId), coreNodeIds, includeBoundary, edgeIds, nodeIds)
      this.collectEdges(this.semantics.outgoing(this.state, nodeId), coreNodeIds, includeBoundary, edgeIds, nodeIds)
    }

    const nodes = [...nodeIds]
      .map((id) => this.state.getNode(id))
      .filter((node): node is NonNullable<typeof node> => node !== undefined)
    const edges = [...edgeIds]
      .map((id) => this.state.getEdge(id))
      .filter((edge): edge is NonNullable<typeof edge> => edge !== undefined)

    return new Subgraph({ nodes, edges, coreNodeIds: [...coreNodeIds] })
  }

  private visitOutgoing(
    nodeId: string,
    visited: Set<string>,
    queue: Array<{ nodeId: string; depth: number }>,
    depth: number,
  ) {
    const edges = this.semantics.outgoing(this.state, nodeId)
    for (const edge of edges) {
      const nextNodeId = edge.target.nodeId
      if (visited.has(nextNodeId)) continue
      visited.add(nextNodeId)
      queue.push({ nodeId: nextNodeId, depth: depth + 1 })
    }
  }

  private visitIncoming(
    nodeId: string,
    visited: Set<string>,
    queue: Array<{ nodeId: string; depth: number }>,
    depth: number,
  ) {
    const edges = this.semantics.incoming(this.state, nodeId)
    for (const edge of edges) {
      const nextNodeId = edge.source.nodeId
      if (visited.has(nextNodeId)) continue
      visited.add(nextNodeId)
      queue.push({ nodeId: nextNodeId, depth: depth + 1 })
    }
  }

  private collectEdges(
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
}

