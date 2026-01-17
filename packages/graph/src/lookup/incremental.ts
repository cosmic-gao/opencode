import type { GraphSpec } from '../model/base'
import type { Edge } from '../model/edge'
import type { Endpoint } from '../model/endpoint'
import type { Input } from '../model/input'
import type { Node } from '../model/node'
import type { Output } from '../model/output'
import type { GraphDelta } from '../delta'
import type { LookupView } from './view'

/**
 * 查表快照数据接口
 * 用于在 Lookup 之间传递索引状态
 */
export interface LookupSnapshot {
  nodeById: Map<string, Node>
  inputById: Map<string, Input>
  outputById: Map<string, Output>
  endpointById: Map<string, Endpoint>
  edgeById: Map<string, Edge>
  endpointOwners: Map<string, string>
  nodeEndpoints: Map<string, Endpoint[]>
  inputEdges: Map<string, string[]>
  outputEdges: Map<string, string[]>
  nodeIncoming: Map<string, string[]>
  nodeOutgoing: Map<string, string[]>
}

/**
 * 增量查表对象 (IncrementalLookup)
 *
 * 专为频繁变更设计的查表实现。支持通过 applyDelta 在现有索引基础上进行增量更新，
 * 避免了全量重建索引的开销。
 *
 * 主要用于 GraphWorkspace 等编辑场景。
 */
export class IncrementalLookup implements LookupView {
  private readonly nodeById = new Map<string, Node>()
  private readonly inputById = new Map<string, Input>()
  private readonly outputById = new Map<string, Output>()
  private readonly endpointById = new Map<string, Endpoint>()
  private readonly edgeById = new Map<string, Edge>()
  
  private readonly endpointOwners = new Map<string, string>()
  
  // 注意：此处存储的是可变数组，以便增量更新
  private readonly nodeEndpoints = new Map<string, Endpoint[]>()
  private readonly inputEdges = new Map<string, string[]>()
  private readonly outputEdges = new Map<string, string[]>()
  private readonly nodeIncoming = new Map<string, string[]>()
  private readonly nodeOutgoing = new Map<string, string[]>()

  /**
   * 创建增量查表对象。
   *
   * @param graph - 可选的初始图定义。如果提供，将建立初始索引。
   */
  constructor(graph?: GraphSpec) {
    if (graph) {
      for (const node of graph.nodes) this.addNode(node)
      for (const edge of graph.edges) this.addEdge(edge)
    }
  }

  /**
   * 获取当前索引状态的快照。
   *
   * 返回的 Map 对象是浅拷贝的，修改返回的 Map 不会影响当前 IncrementalLookup，
   * 但 Map 中的值（如数组）仍然是引用的。
   * 此方法主要用于将状态高效转移给不可变的 Lookup 对象。
   */
  getSnapshot(): LookupSnapshot {
    return {
      nodeById: new Map(this.nodeById),
      inputById: new Map(this.inputById),
      outputById: new Map(this.outputById),
      endpointById: new Map(this.endpointById),
      edgeById: new Map(this.edgeById),
      endpointOwners: new Map(this.endpointOwners),
      nodeEndpoints: new Map(this.nodeEndpoints),
      inputEdges: new Map(this.inputEdges),
      outputEdges: new Map(this.outputEdges),
      nodeIncoming: new Map(this.nodeIncoming),
      nodeOutgoing: new Map(this.nodeOutgoing),
    }
  }

  /**
   * 应用图变更 (Delta)。
   *
   * @param delta - 变更描述
   */
  applyDelta(delta: GraphDelta): void {
    this.apply(delta)
  }

  /**
   * 应用图变更 (Delta) 的内部实现。
   *
   * @param delta - 变更描述
   */
  apply(delta: GraphDelta): void {
    if (delta.removedEdgeIds) {
      for (const edgeId of delta.removedEdgeIds) this.removeEdge(edgeId)
    }
    if (delta.removedNodeIds) {
      for (const nodeId of delta.removedNodeIds) this.removeNode(nodeId)
    }
    if (delta.addedNodes) {
      for (const node of delta.addedNodes) this.addNode(node)
    }
    if (delta.addedEdges) {
      for (const edge of delta.addedEdges) this.addEdge(edge)
    }
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

  getEndpointNodeId(endpointId: string): string | undefined {
    return this.endpointOwners.get(endpointId)
  }

  getNodeEndpoints(nodeId: string): readonly Endpoint[] {
    return this.nodeEndpoints.get(nodeId) ?? []
  }

  getIncomingIds(inputId: string): readonly string[] {
    return this.inputEdges.get(inputId) ?? []
  }

  getOutgoingIds(outputId: string): readonly string[] {
    return this.outputEdges.get(outputId) ?? []
  }

  getIncomingCount(inputId: string): number {
    return this.inputEdges.get(inputId)?.length ?? 0
  }

  getOutgoingCount(outputId: string): number {
    return this.outputEdges.get(outputId)?.length ?? 0
  }

  getIncomingEdges(inputId: string): readonly Edge[] {
    const edgeIds = this.inputEdges.get(inputId)
    if (!edgeIds) return []
    return this.getEdges(edgeIds)
  }

  getOutgoingEdges(outputId: string): readonly Edge[] {
    const edgeIds = this.outputEdges.get(outputId)
    if (!edgeIds) return []
    return this.getEdges(edgeIds)
  }

  getNodeIncoming(nodeId: string): readonly Edge[] {
    const edgeIds = this.nodeIncoming.get(nodeId)
    if (!edgeIds) return []
    return this.getEdges(edgeIds)
  }

  getNodeOutgoing(nodeId: string): readonly Edge[] {
    const edgeIds = this.nodeOutgoing.get(nodeId)
    if (!edgeIds) return []
    return this.getEdges(edgeIds)
  }

  // --- 内部状态更新方法 ---

  private addNode(node: Node): void {
    if (this.nodeById.has(node.id)) return
    this.nodeById.set(node.id, node)

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

  private removeNode(nodeId: string): void {
    const node = this.nodeById.get(nodeId)
    if (!node) return

    const endpoints = this.nodeEndpoints.get(nodeId) ?? []
    const incidentEdgeIds = new Set<string>()

    for (const endpoint of endpoints) {
      for (const edgeId of this.getIncomingIds(endpoint.id)) incidentEdgeIds.add(edgeId)
      for (const edgeId of this.getOutgoingIds(endpoint.id)) incidentEdgeIds.add(edgeId)
    }

    for (const edgeId of incidentEdgeIds) this.removeEdge(edgeId)

    for (const input of node.inputs) {
      this.inputById.delete(input.id)
      this.endpointById.delete(input.id)
      this.endpointOwners.delete(input.id)
      this.inputEdges.delete(input.id)
    }

    for (const output of node.outputs) {
      this.outputById.delete(output.id)
      this.endpointById.delete(output.id)
      this.endpointOwners.delete(output.id)
      this.outputEdges.delete(output.id)
    }

    this.nodeEndpoints.delete(nodeId)
    this.nodeIncoming.delete(nodeId)
    this.nodeOutgoing.delete(nodeId)
    this.nodeById.delete(nodeId)
  }

  private addEdge(edge: Edge): void {
    if (this.edgeById.has(edge.id)) return
    this.edgeById.set(edge.id, edge)

    this.ensureList(this.outputEdges, edge.source.endpointId).push(edge.id)
    this.ensureList(this.inputEdges, edge.target.endpointId).push(edge.id)
    this.ensureList(this.nodeOutgoing, edge.source.nodeId).push(edge.id)
    this.ensureList(this.nodeIncoming, edge.target.nodeId).push(edge.id)
  }

  private removeEdge(edgeId: string): void {
    const edge = this.edgeById.get(edgeId)
    if (!edge) return

    this.removeFromList(this.outputEdges.get(edge.source.endpointId), edgeId)
    this.removeFromList(this.inputEdges.get(edge.target.endpointId), edgeId)
    this.removeFromList(this.nodeOutgoing.get(edge.source.nodeId), edgeId)
    this.removeFromList(this.nodeIncoming.get(edge.target.nodeId), edgeId)

    this.edgeById.delete(edgeId)
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

  private getEdges(edgeIds: readonly string[]): readonly Edge[] {
    const edges: Edge[] = []

    for (const edgeId of edgeIds) {
      const edge = this.edgeById.get(edgeId)
      if (edge) edges.push(edge)
    }

    return edges
  }

  private ensureList(map: Map<string, string[]>, key: string): string[] {
    const existing = map.get(key)
    if (existing) return existing

    const created: string[] = []
    map.set(key, created)
    return created
  }
}
