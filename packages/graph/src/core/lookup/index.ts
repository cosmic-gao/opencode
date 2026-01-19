import type { Edge, Endpoint, Graph, Input, Node, Output } from '../model'
import type { Patch } from '../state'
import type { Scope } from './scope'
import { ListMap } from './list-map'

export type { Scope }

/**
 * 索引 (Index)
 *
 * 维护图数据的反向查找索引，提供 O(1) 的查询能力。
 * 它是可变的，随 Graph 的变更而增量更新。
 *
 * 主要职责：
 * - 维护 ID 到对象的映射（尽管 Graph 也有，但此处用于统一查询接口）
 * - 维护反向关系：
 *   - Endpoint -> Owner Node
 *   - Node -> Endpoints
 *   - Node/Endpoint -> Incoming/Outgoing Edges
 */
export class Index implements Scope {
  private readonly nodeById: Map<string, Node> = new Map()
  private readonly inputById: Map<string, Input> = new Map()
  private readonly outputById: Map<string, Output> = new Map()
  private readonly endpointById: Map<string, Endpoint> = new Map()
  private readonly edgeById: Map<string, Edge> = new Map()

  private readonly endpointOwners: Map<string, string> = new Map()

  private readonly nodeEndpoints: Map<string, Endpoint[]> = new Map()
  
  // 使用 ListMap 抽象管理边列表
  private readonly inputEdgeMap = new ListMap<string>()
  private readonly outputEdgeMap = new ListMap<string>()
  private readonly nodeIncoming = new ListMap<string>()
  private readonly nodeOutgoing = new ListMap<string>()

  /**
   * 创建索引实例。
   *
   * @param graph - 初始图对象
   */
  constructor(graph?: Graph) {
    if (graph) this.rebuild(graph)
  }

  /**
   * 基于 Graph 全量重建索引。
   *
   * @param graph - 图对象
   */
  rebuild(graph: Graph): void {
    this.clear()
    for (const node of graph.nodes.values()) this.addNode(node)
    for (const edge of graph.edges.values()) this.addEdge(edge)
  }

  /**
   * 应用补丁进行增量更新。
   *
   * @param patch - 事实补丁
   */
  patch(patch: Patch): void {
    if (patch.edgeRemove) for (const edgeId of patch.edgeRemove) this.removeEdge(edgeId)
    if (patch.nodeRemove) for (const nodeId of patch.nodeRemove) this.removeNode(nodeId)
    if (patch.nodeReplace) for (const node of patch.nodeReplace) this.replaceNode(node)
    if (patch.edgeReplace) for (const edge of patch.edgeReplace) this.replaceEdge(edge)
    if (patch.nodeAdd) for (const node of patch.nodeAdd) this.addNode(node)
    if (patch.edgeAdd) for (const edge of patch.edgeAdd) this.addEdge(edge)
  }

  // --- 查询接口 (Scope Implementation) ---

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
    this.nodeIncoming.innerMap.delete(nodeId)
    this.nodeOutgoing.innerMap.delete(nodeId)
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
        this.inputEdgeMap.innerMap.delete(input.id)
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
        this.outputEdgeMap.innerMap.delete(output.id)
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

    this.inputEdgeMap.ensure(edge.target.endpointId).push(edge.id)
    this.outputEdgeMap.ensure(edge.source.endpointId).push(edge.id)
    this.nodeIncoming.ensure(edge.target.nodeId).push(edge.id)
    this.nodeOutgoing.ensure(edge.source.nodeId).push(edge.id)
  }

  private removeEdge(edgeId: string): void {
    const edge = this.edgeById.get(edgeId)
    if (!edge) return

    this.inputEdgeMap.remove(edge.target.endpointId, edgeId)
    this.outputEdgeMap.remove(edge.source.endpointId, edgeId)
    this.nodeIncoming.remove(edge.target.nodeId, edgeId)
    this.nodeOutgoing.remove(edge.source.nodeId, edgeId)

    this.edgeById.delete(edgeId)
  }

  private replaceEdge(edge: Edge): void {
    const existing = this.edgeById.get(edge.id)
    if (!existing) {
      throw new Error(`Missing edge id for replace: ${edge.id}`)
    }

    this.inputEdgeMap.remove(existing.target.endpointId, existing.id)
    this.outputEdgeMap.remove(existing.source.endpointId, existing.id)
    this.nodeIncoming.remove(existing.target.nodeId, existing.id)
    this.nodeOutgoing.remove(existing.source.nodeId, existing.id)

    this.edgeById.set(edge.id, edge)
    
    this.inputEdgeMap.ensure(edge.target.endpointId).push(edge.id)
    this.outputEdgeMap.ensure(edge.source.endpointId).push(edge.id)
    this.nodeIncoming.ensure(edge.target.nodeId).push(edge.id)
    this.nodeOutgoing.ensure(edge.source.nodeId).push(edge.id)
  }

  private *getEdges(edgeIds: readonly string[]): IterableIterator<Edge> {
    for (const edgeId of edgeIds) {
      const edge = this.edgeById.get(edgeId)
      if (edge) yield edge
    }
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
