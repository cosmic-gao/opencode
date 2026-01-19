import type { Edge, Endpoint, Input, Node, Output } from '../model'
import type { Store, Patch } from '../state'
import type { LookupView } from './view'


/**
 * 增量查表对象 (IncrementalLookup)
 *
 * 专为频繁变更设计的查表实现。支持通过 applyPatch 在现有索引基础上进行增量更新，
 * 避免了全量重建索引的开销。
 *
 * 适用场景：
 * - 实时编辑器 (GraphWorkspace)
 * - 动态校验
 *
 * 主要特性：
 * - **可变性**：内部状态可变，随补丁更新。
 * - **高性能**：增量更新复杂度通常远小于全量重建。
 */
export class IncrementalLookup implements LookupView {
  private readonly nodeById: Map<string, Node> = new Map()
  private readonly inputById: Map<string, Input> = new Map()
  private readonly outputById: Map<string, Output> = new Map()
  private readonly endpointById: Map<string, Endpoint> = new Map()
  private readonly edgeById: Map<string, Edge> = new Map()
  
  private readonly endpointOwners: Map<string, string> = new Map()
  
  private readonly nodeEndpoints: Map<string, Endpoint[]> = new Map()
  private readonly inputEdgeMap: Map<string, string[]> = new Map()
  private readonly outputEdgeMap: Map<string, string[]> = new Map()
  private readonly nodeIncoming: Map<string, string[]> = new Map()
  private readonly nodeOutgoing: Map<string, string[]> = new Map()


  /**
   * 创建增量查表对象。
   *
   * @param state - 可选的初始图状态。如果提供，将建立初始索引。
   */
  constructor(state?: Store) {
    if (state) this.rebuild(state)
  }

  /**
   * 基于当前 Store 全量重建索引。
   *
   * @param state - 图状态
   */
  rebuild(state: Store): void {
    this.clear()
    for (const node of state.listNodes) this.addNode(node)
    for (const edge of state.listEdges) this.addEdge(edge)
  }


  /**
   * 应用补丁进行增量更新。
   *
   * @param patch - 事实补丁
   */
  applyPatch(patch: Patch): void {
    if (patch.edgeRemove) for (const edgeId of patch.edgeRemove) this.removeEdge(edgeId)
    if (patch.nodeRemove) for (const nodeId of patch.nodeRemove) this.removeNode(nodeId)
    if (patch.nodeReplace) for (const node of patch.nodeReplace) this.replaceNode(node)
    if (patch.edgeReplace) for (const edge of patch.edgeReplace) this.replaceEdge(edge)
    if (patch.nodeAdd) for (const node of patch.nodeAdd) this.addNode(node)
    if (patch.edgeAdd) for (const edge of patch.edgeAdd) this.addEdge(edge)
  }

  // --- 查询接口 (与 Lookup 一致) ---

  hasNode(id: string): boolean {
    return this.nodeById.has(id)
  }

  hasEdge(id: string): boolean {
    return this.edgeById.has(id)
  }

  hasEndpoint(id: string): boolean {
    return this.endpointById.has(id)
  }

  getNode(id: string): Node | undefined {
    return this.nodeById.get(id)
  }

  getEdge(id: string): Edge | undefined {
    return this.edgeById.get(id)
  }

  getEndpoint(id: string): Endpoint | undefined {
    return this.endpointById.get(id)
  }

  getInput(id: string): Input | undefined {
    return this.inputById.get(id)
  }

  getOutput(id: string): Output | undefined {
    return this.outputById.get(id)
  }

  owner(endpointId: string): string | undefined {
    return this.endpointOwners.get(endpointId)
  }

  endpoints(nodeId: string): readonly Endpoint[] {
    return this.nodeEndpoints.get(nodeId) ?? []
  }

  inputIds(inputId: string): readonly string[] {
    return this.inputEdgeMap.get(inputId) ?? []
  }

  outputIds(outputId: string): readonly string[] {
    return this.outputEdgeMap.get(outputId) ?? []
  }

  inputCount(inputId: string): number {
    return this.inputEdgeMap.get(inputId)?.length ?? 0
  }

  outputCount(outputId: string): number {
    return this.outputEdgeMap.get(outputId)?.length ?? 0
  }

  *inputEdges(inputId: string): IterableIterator<Edge> {
    const edgeIds = this.inputEdgeMap.get(inputId)
    if (edgeIds) yield* this.getEdges(edgeIds)
  }

  *outputEdges(outputId: string): IterableIterator<Edge> {
    const edgeIds = this.outputEdgeMap.get(outputId)
    if (edgeIds) yield* this.getEdges(edgeIds)
  }


  *incoming(nodeId: string): IterableIterator<Edge> {
    const edgeIds = this.nodeIncoming.get(nodeId)
    if (edgeIds) yield* this.getEdges(edgeIds)
  }

  *outgoing(nodeId: string): IterableIterator<Edge> {
    const edgeIds = this.nodeOutgoing.get(nodeId)
    if (edgeIds) yield* this.getEdges(edgeIds)
  }


  // --- 内部状态更新方法 ---

  private addNode(node: Node): void {
    if (this.nodeById.has(node.id)) return
    this.nodeById.set(node.id, node)
    this.addNodeEndpoints(node)
  }

  private replaceNode(node: Node): void {
    const existing = this.nodeById.get(node.id)
    if (!existing) {
      throw new Error(`Missing node id for replace: ${node.id}`)
    }

    const keptEndpointIdSet = new Set<string>([
      ...node.inputs.map((input) => input.id),
      ...node.outputs.map((output) => output.id),
    ])
    this.removeNodeEndpoints(existing, keptEndpointIdSet)
    this.nodeById.set(node.id, node)
    this.addNodeEndpoints(node)
  }

  private removeNode(nodeId: string): void {
    const node = this.nodeById.get(nodeId)
    if (!node) return

    this.removeNodeEndpoints(node)
    this.nodeEndpoints.delete(nodeId)
    this.nodeIncoming.delete(nodeId)
    this.nodeOutgoing.delete(nodeId)
    this.nodeById.delete(nodeId)
  }

  private removeNodeEndpoints(node: Node, keptEndpointIdSet?: ReadonlySet<string>): void {
    for (const input of node.inputs) {
      const isKept = keptEndpointIdSet?.has(input.id) === true
      this.inputById.delete(input.id)
      this.endpointById.delete(input.id)
      this.endpointOwners.delete(input.id)
      if (!isKept) {
        const edgeIds = this.inputEdgeMap.get(input.id)
        if (edgeIds && edgeIds.length > 0) throw new Error(`Input has edges: ${input.id}`)
        this.inputEdgeMap.delete(input.id)
      }
    }
    for (const output of node.outputs) {
      const isKept = keptEndpointIdSet?.has(output.id) === true
      this.outputById.delete(output.id)
      this.endpointById.delete(output.id)
      this.endpointOwners.delete(output.id)
      if (!isKept) {
        const edgeIds = this.outputEdgeMap.get(output.id)
        if (edgeIds && edgeIds.length > 0) throw new Error(`Output has edges: ${output.id}`)
        this.outputEdgeMap.delete(output.id)
      }
    }

  }

  private addNodeEndpoints(node: Node): void {
    const endpoints: Endpoint[] = []
    for (const input of node.inputs) {
      this.inputById.set(input.id, input)
      this.endpointById.set(input.id, input)
      this.endpointOwners.set(input.id, node.id)
      endpoints.push(input)
    }
    for (const output of node.outputs) {
      this.outputById.set(output.id, output)
      this.endpointById.set(output.id, output)
      this.endpointOwners.set(output.id, node.id)
      endpoints.push(output)
    }
    this.nodeEndpoints.set(node.id, endpoints)
  }

  private addEdge(edge: Edge): void {
    if (this.edgeById.has(edge.id)) return
    this.edgeById.set(edge.id, edge)

    this.ensureList(this.outputEdgeMap, edge.source.endpointId).push(edge.id)
    this.ensureList(this.inputEdgeMap, edge.target.endpointId).push(edge.id)
    this.ensureList(this.nodeOutgoing, edge.source.nodeId).push(edge.id)
    this.ensureList(this.nodeIncoming, edge.target.nodeId).push(edge.id)
  }

  private removeEdge(edgeId: string): void {
    const edge = this.edgeById.get(edgeId)
    if (!edge) return

    this.removeFromList(this.outputEdgeMap.get(edge.source.endpointId), edgeId)
    this.removeFromList(this.inputEdgeMap.get(edge.target.endpointId), edgeId)
    this.removeFromList(this.nodeOutgoing.get(edge.source.nodeId), edgeId)
    this.removeFromList(this.nodeIncoming.get(edge.target.nodeId), edgeId)

    this.edgeById.delete(edgeId)
  }

  private replaceEdge(edge: Edge): void {
    const existing = this.edgeById.get(edge.id)
    if (!existing) {
      throw new Error(`Missing edge id for replace: ${edge.id}`)
    }

    this.removeFromList(this.outputEdgeMap.get(existing.source.endpointId), existing.id)
    this.removeFromList(this.inputEdgeMap.get(existing.target.endpointId), existing.id)
    this.removeFromList(this.nodeOutgoing.get(existing.source.nodeId), existing.id)
    this.removeFromList(this.nodeIncoming.get(existing.target.nodeId), existing.id)

    this.edgeById.set(edge.id, edge)
    this.ensureList(this.outputEdgeMap, edge.source.endpointId).push(edge.id)
    this.ensureList(this.inputEdgeMap, edge.target.endpointId).push(edge.id)
    this.ensureList(this.nodeOutgoing, edge.source.nodeId).push(edge.id)
    this.ensureList(this.nodeIncoming, edge.target.nodeId).push(edge.id)
  }


  private removeFromList(list: string[] | undefined, value: string): void {
    if (!list || list.length === 0) return
    const index = list.indexOf(value)
    if (index < 0) return
    const lastIndex = list.length - 1
    const lastValue = list[lastIndex]
    if (lastValue === undefined) return
    if (index !== lastIndex) list[index] = lastValue
    list.pop()
  }

  private *getEdges(edgeIds: readonly string[]): IterableIterator<Edge> {
    for (const edgeId of edgeIds) {
      const edge = this.edgeById.get(edgeId)
      if (edge) yield edge
    }
  }

  private ensureList(map: Map<string, string[]>, key: string): string[] {
    const existing = map.get(key)
    if (existing) return existing

    const created: string[] = []
    map.set(key, created)
    return created
  }

  private clear(): void {
    this.nodeById.clear()
    this.inputById.clear()
    this.outputById.clear()
    this.endpointById.clear()
    this.edgeById.clear()
    this.endpointOwners.clear()
    this.nodeEndpoints.clear()
    this.inputEdgeMap.clear()
    this.outputEdgeMap.clear()
    this.nodeIncoming.clear()
    this.nodeOutgoing.clear()
  }


}
