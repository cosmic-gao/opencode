import type { Edge, Endpoint, Input, Node, Output } from '../model'

/**
 * 注册表 (Registry)
 *
 * 维护图数据的内存索引，提供 O(1) 的快速查找能力。
 * 它是 Store 的内部实现细节，负责管理节点、边、端点及其相互关系（如归属、连接）的映射。
 *
 * 主要索引：
 * - ID 映射：通过 ID 查找 Node, Edge, Endpoint
 * - 关系映射：
 *   - Node -> Endpoints
 *   - Node -> Incoming/Outgoing Edges
 *   - Endpoint -> Incoming/Outgoing Edges
 */
export class Registry {
  readonly nodes = new Map<string, Node>()
  readonly edges = new Map<string, Edge>()

  readonly inputs = new Map<string, Input>()
  readonly outputs = new Map<string, Output>()
  readonly endpoints = new Map<string, Endpoint>()
  readonly owners = new Map<string, string>()
  readonly nodeEndpoints = new Map<string, readonly Endpoint[]>()

  readonly nodeOutgoing = new Map<string, string[]>()
  readonly nodeIncoming = new Map<string, string[]>()

  readonly inputIncoming = new Map<string, string[]>()
  readonly outputOutgoing = new Map<string, string[]>()

  /**
   * 创建注册表实例。
   *
   * @param nodes - 初始节点列表
   * @param edges - 初始边列表
   */
  constructor(nodes: readonly Node[] = [], edges: readonly Edge[] = []) {
    for (const node of nodes) {
      this.addNode(node)
    }
    for (const edge of edges) {
      this.addEdge(edge)
    }
  }

  /**
   * 获取指定 ID 的节点。
   *
   * @param nodeId - 节点 ID
   * @returns 节点对象，若不存在返回 undefined
   */
  getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId)
  }

  /**
   * 获取指定 ID 的边。
   *
   * @param edgeId - 边 ID
   * @returns 边对象，若不存在返回 undefined
   */
  getEdge(edgeId: string): Edge | undefined {
    return this.edges.get(edgeId)
  }

  /**
   * 检查节点是否存在。
   *
   * @param nodeId - 节点 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId)
  }

  /**
   * 检查边是否存在。
   *
   * @param edgeId - 边 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasEdge(edgeId: string): boolean {
    return this.edges.has(edgeId)
  }

  /**
   * 检查端点是否存在。
   *
   * @param endpointId - 端点 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasEndpoint(endpointId: string): boolean {
    return this.endpoints.has(endpointId)
  }

  /**
   * 获取指定 ID 的端点。
   *
   * @param endpointId - 端点 ID
   * @returns 端点对象，若不存在返回 undefined
   */
  getEndpoint(endpointId: string): Endpoint | undefined {
    return this.endpoints.get(endpointId)
  }

  /**
   * 获取指定 ID 的输入端点。
   *
   * @param endpointId - 端点 ID
   * @returns 输入端点对象，若不存在或不是输入端点返回 undefined
   */
  getInput(endpointId: string): Input | undefined {
    return this.inputs.get(endpointId)
  }

  /**
   * 获取指定 ID 的输出端点。
   *
   * @param endpointId - 端点 ID
   * @returns 输出端点对象，若不存在或不是输出端点返回 undefined
   */
  getOutput(endpointId: string): Output | undefined {
    return this.outputs.get(endpointId)
  }

  /**
   * 获取端点所属的节点 ID。
   *
   * @param endpointId - 端点 ID
   * @returns 节点 ID，若端点不存在返回 undefined
   */
  owner(endpointId: string): string | undefined {
    return this.owners.get(endpointId)
  }

  /**
   * 获取指定节点的所有端点。
   *
   * @param nodeId - 节点 ID
   * @returns 端点列表（只读），若节点不存在返回空数组
   */
  endpointsOf(nodeId: string): readonly Endpoint[] {
    return this.nodeEndpoints.get(nodeId) ?? []
  }

  /**
   * 获取所有节点列表。
   *
   * @returns 节点列表（只读迭代器）
   */
  get listNodes(): IterableIterator<Node> {
    return this.nodes.values()
  }

  /**
   * 获取所有边列表。
   *
   * @returns 边列表（只读迭代器）
   */
  get listEdges(): IterableIterator<Edge> {
    return this.edges.values()
  }

  /**
   * 获取指定节点的出边（从该节点输出端点发出的边）。
   *
   * @param nodeId - 节点 ID
   * @returns 边列表（只读迭代器）
   */
  *outgoing(nodeId: string): IterableIterator<Edge> {
    const edgeIds = this.nodeOutgoing.get(nodeId)
    if (edgeIds) {
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId)
        if (edge) yield edge
      }
    }
  }

  /**
   * 获取指定节点的入边（指向该节点输入端点的边）。
   *
   * @param nodeId - 节点 ID
   * @returns 边列表（只读迭代器）
   */
  *incoming(nodeId: string): IterableIterator<Edge> {
    const edgeIds = this.nodeIncoming.get(nodeId)
    if (edgeIds) {
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId)
        if (edge) yield edge
      }
    }
  }

  /**
   * 获取连接到指定输入端点的边。
   *
   * @param inputId - 输入端点 ID
   * @returns 边列表（只读迭代器）
   */
  *inputEdges(inputId: string): IterableIterator<Edge> {
    const edgeIds = this.inputIncoming.get(inputId)
    if (edgeIds) {
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId)
        if (edge) yield edge
      }
    }
  }

  /**
   * 获取从指定输出端点发出的边。
   *
   * @param outputId - 输出端点 ID
   * @returns 边列表（只读迭代器）
   */
  *outputEdges(outputId: string): IterableIterator<Edge> {
    const edgeIds = this.outputOutgoing.get(outputId)
    if (edgeIds) {
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId)
        if (edge) yield edge
      }
    }
  }

  /**
   * 添加新节点并建立索引。
   *
   * @param node - 节点对象
   * @throws {Error} 当节点 ID 已存在时抛出错误
   */
  addNode(node: Node): void {
    if (this.nodes.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`)
    this.nodes.set(node.id, node)
    this.indexNode(node)
  }

  /**
   * 替换现有节点并更新索引。
   *
   * @param node - 新节点对象（ID 必须与旧节点一致）
   * @throws {Error} 当节点 ID 不存在时抛出错误
   */
  replaceNode(node: Node): void {
    const prev = this.nodes.get(node.id)
    if (!prev) throw new Error(`Missing node id for replace: ${node.id}`)
    this.unindexNode(prev, node)
    this.nodes.set(node.id, node)
    this.indexNode(node)
  }

  /**
   * 移除节点并清除索引。
   *
   * @param nodeId - 节点 ID
   * @throws {Error} 当节点 ID 不存在或仍有边连接时抛出错误
   */
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId)
    if (!node) throw new Error(`Missing node id for remove: ${nodeId}`)

    const outgoing = this.nodeOutgoing.get(nodeId)
    if (outgoing && outgoing.length > 0) throw new Error(`Node has outgoing edges: ${nodeId}`)
    const incoming = this.nodeIncoming.get(nodeId)
    if (incoming && incoming.length > 0) throw new Error(`Node has incoming edges: ${nodeId}`)

    this.unindexNode(node)
    this.nodes.delete(nodeId)
  }

  /**
   * 添加新边并建立索引。
   *
   * @param edge - 边对象
   * @throws {Error} 当边 ID 已存在时抛出错误
   */
  addEdge(edge: Edge): void {
    if (this.edges.has(edge.id)) throw new Error(`Duplicate edge id: ${edge.id}`)
    this.edges.set(edge.id, edge)
    this.indexEdge(edge)
  }

  /**
   * 替换现有边并更新索引。
   *
   * @param edge - 新边对象（ID 必须与旧边一致）
   * @throws {Error} 当边 ID 不存在时抛出错误
   */
  replaceEdge(edge: Edge): void {
    const prev = this.edges.get(edge.id)
    if (!prev) throw new Error(`Missing edge id for replace: ${edge.id}`)
    this.unindexEdge(prev)
    this.edges.set(edge.id, edge)
    this.indexEdge(edge)
  }

  /**
   * 移除边并清除索引。
   *
   * @param edgeId - 边 ID
   * @throws {Error} 当边 ID 不存在时抛出错误
   */
  removeEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId)
    if (!edge) throw new Error(`Missing edge id for remove: ${edgeId}`)
    this.unindexEdge(edge)
    this.edges.delete(edgeId)
  }

  private pushEdge(listMap: Map<string, string[]>, key: string, edgeId: string): void {
    const list = listMap.get(key)
    if (list) {
      list.push(edgeId)
      return
    }
    listMap.set(key, [edgeId])
  }

  private indexNode(node: Node): void {
    const endpoints: Endpoint[] = []

    for (const input of node.inputs) {
      if (this.endpoints.has(input.id)) throw new Error(`Duplicate endpoint id: ${input.id}`)
      this.inputs.set(input.id, input)
      this.endpoints.set(input.id, input)
      this.owners.set(input.id, node.id)
      endpoints.push(input)
    }

    for (const output of node.outputs) {
      if (this.endpoints.has(output.id)) throw new Error(`Duplicate endpoint id: ${output.id}`)
      this.outputs.set(output.id, output)
      this.endpoints.set(output.id, output)
      this.owners.set(output.id, node.id)
      endpoints.push(output)
    }

    this.nodeEndpoints.set(node.id, Object.freeze(endpoints))
  }

  private unindexNode(node: Node, nextNode?: Node): void {
    const nextEndpointIdSet = nextNode
      ? new Set<string>([...nextNode.inputs.map((input) => input.id), ...nextNode.outputs.map((output) => output.id)])
      : undefined

    for (const input of node.inputs) {
      const isKept = nextEndpointIdSet?.has(input.id) === true
      this.inputs.delete(input.id)
      this.endpoints.delete(input.id)
      this.owners.delete(input.id)

      if (!isKept) {
        const incoming = this.inputIncoming.get(input.id)
        if (incoming && incoming.length > 0) throw new Error(`Input has edges: ${input.id}`)
        this.inputIncoming.delete(input.id)
      }
    }

    for (const output of node.outputs) {
      const isKept = nextEndpointIdSet?.has(output.id) === true
      this.outputs.delete(output.id)
      this.endpoints.delete(output.id)
      this.owners.delete(output.id)

      if (!isKept) {
        const outgoing = this.outputOutgoing.get(output.id)
        if (outgoing && outgoing.length > 0) throw new Error(`Output has edges: ${output.id}`)
        this.outputOutgoing.delete(output.id)
      }
    }

    this.nodeEndpoints.delete(node.id)
  }

  private indexEdge(edge: Edge): void {
    this.pushEdge(this.nodeOutgoing, edge.source.nodeId, edge.id)
    this.pushEdge(this.nodeIncoming, edge.target.nodeId, edge.id)
    this.pushEdge(this.outputOutgoing, edge.source.endpointId, edge.id)
    this.pushEdge(this.inputIncoming, edge.target.endpointId, edge.id)
  }

  private unindexEdge(edge: Edge): void {
    this.removeEdgeRef(this.nodeOutgoing.get(edge.source.nodeId), edge.id)
    this.removeEdgeRef(this.nodeIncoming.get(edge.target.nodeId), edge.id)
    this.removeEdgeRef(this.outputOutgoing.get(edge.source.endpointId), edge.id)
    this.removeEdgeRef(this.inputIncoming.get(edge.target.endpointId), edge.id)
  }

  private removeEdgeRef(list: string[] | undefined, edgeId: string): void {
    if (!list) return
    const index = list.indexOf(edgeId)
    if (index < 0) return
    list.splice(index, 1)
  }
}
