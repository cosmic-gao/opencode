import type { Edge, Node } from '../model'
import type { Patch, UndoPatch } from './patch'
import type { Registry } from './registry'

export class Applier {
  constructor(private readonly registry: Registry) {}

  apply(patch: Patch): UndoPatch {
    this.assert(patch)

    const undo: UndoPatch = {}

    if (patch.nodeReplace) undo.nodeReplace = this.invertNodes(patch.nodeReplace)
    if (patch.edgeReplace) undo.edgeReplace = this.invertEdges(patch.edgeReplace)
    if (patch.edgeRemove) undo.edgeAdd = this.invertEdgeRemove(patch.edgeRemove)
    if (patch.nodeRemove) undo.nodeAdd = this.invertNodeRemove(patch.nodeRemove)
    if (patch.nodeAdd) undo.nodeRemove = patch.nodeAdd.map((node) => node.id)
    if (patch.edgeAdd) undo.edgeRemove = patch.edgeAdd.map((edge) => edge.id)

    this.replaceNodes(patch.nodeReplace)
    this.replaceEdges(patch.edgeReplace)
    this.removeEdges(patch.edgeRemove)
    this.removeNodes(patch.nodeRemove)
    this.addNodes(patch.nodeAdd)
    this.addEdges(patch.edgeAdd)

    return undo
  }

  private assert(patch: Patch): void {
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()

    this.track(nodeIds, patch.nodeAdd?.map((node) => node.id))
    this.track(nodeIds, patch.nodeRemove)
    this.track(nodeIds, patch.nodeReplace?.map((node) => node.id))
    this.track(edgeIds, patch.edgeAdd?.map((edge) => edge.id))
    this.track(edgeIds, patch.edgeRemove)
    this.track(edgeIds, patch.edgeReplace?.map((edge) => edge.id))
  }

  private track(target: Set<string>, ids: readonly string[] | undefined): void {
    if (!ids) return
    for (const id of ids) {
      if (target.has(id)) throw new Error(`Conflicting patch id: ${id}`)
      target.add(id)
    }
  }

  private invertNodes(nodes: readonly Node[]): readonly Node[] {
    const next: Node[] = []
    for (const node of nodes) {
      const prev = this.registry.getNode(node.id)
      if (!prev) throw new Error(`Missing node id for replace: ${node.id}`)
      next.push(prev)
    }
    return Object.freeze(next)
  }

  private invertEdges(edges: readonly Edge[]): readonly Edge[] {
    const next: Edge[] = []
    for (const edge of edges) {
      const prev = this.registry.getEdge(edge.id)
      if (!prev) throw new Error(`Missing edge id for replace: ${edge.id}`)
      next.push(prev)
    }
    return Object.freeze(next)
  }

  private invertEdgeRemove(edgeIds: readonly string[]): readonly Edge[] {
    const next: Edge[] = []
    for (const edgeId of edgeIds) {
      const edge = this.registry.getEdge(edgeId)
      if (!edge) throw new Error(`Missing edge id for remove: ${edgeId}`)
      next.push(edge)
    }
    return Object.freeze(next)
  }

  private invertNodeRemove(nodeIds: readonly string[]): readonly Node[] {
    const next: Node[] = []
    for (const nodeId of nodeIds) {
      const node = this.registry.getNode(nodeId)
      if (!node) throw new Error(`Missing node id for remove: ${nodeId}`)
      next.push(node)
    }
    return Object.freeze(next)
  }

  private replaceNodes(nodes: readonly Node[] | undefined): void {
    if (!nodes) return
    for (const node of nodes) this.registry.replaceNode(node)
  }

  private replaceEdges(edges: readonly Edge[] | undefined): void {
    if (!edges) return
    for (const edge of edges) this.registry.replaceEdge(edge)
  }

  private removeEdges(edgeIds: readonly string[] | undefined): void {
    if (!edgeIds) return
    for (const edgeId of edgeIds) this.registry.removeEdge(edgeId)
  }

  private removeNodes(nodeIds: readonly string[] | undefined): void {
    if (!nodeIds) return
    for (const nodeId of nodeIds) this.registry.removeNode(nodeId)
  }

  private addNodes(nodes: readonly Node[] | undefined): void {
    if (!nodes) return
    for (const node of nodes) this.registry.addNode(node)
  }

  private addEdges(edges: readonly Edge[] | undefined): void {
    if (!edges) return
    for (const edge of edges) this.registry.addEdge(edge)
  }
}
