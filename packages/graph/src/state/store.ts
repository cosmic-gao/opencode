import { Graph, type Edge, type Endpoint, type Input, type Node, type Output } from '../model'
import type { Patch, UndoPatch } from '.'

export interface StoreOptions {
  nodes?: readonly Node[]
  edges?: readonly Edge[]
  metadata?: Record<string, unknown>
}

export class GraphStore {
  readonly metadata?: Record<string, unknown>

  private readonly nodeMap: Map<string, Node>
  private readonly edgeMap: Map<string, Edge>

  private readonly inputMap: Map<string, Input>
  private readonly outputMap: Map<string, Output>
  private readonly endpointMap: Map<string, Endpoint>
  private readonly endpointOwner: Map<string, string>
  private readonly nodeEndpoints: Map<string, readonly Endpoint[]>

  private readonly nodeOutgoing: Map<string, string[]>
  private readonly nodeIncoming: Map<string, string[]>

  private readonly inputIncoming: Map<string, string[]>
  private readonly outputOutgoing: Map<string, string[]>

  /**
   * 创建图状态。
   *
   * @param options - 初始化选项
   */
  constructor(options: StoreOptions) {
    this.metadata = options.metadata

    const nodes = options.nodes ?? []
    const edges = options.edges ?? []

    const nodeMap = new Map<string, Node>()
    for (const node of nodes) {
      if (nodeMap.has(node.id)) {
        throw new Error(`Duplicate node id: ${node.id}`)
      }
      nodeMap.set(node.id, node)
    }

    const endpointIndex = indexEndpoints(nodes)

    const edgeMap = new Map<string, Edge>()
    for (const edge of edges) {
      if (edgeMap.has(edge.id)) {
        throw new Error(`Duplicate edge id: ${edge.id}`)
      }
      edgeMap.set(edge.id, edge)
    }

    const nodeOutgoing = new Map<string, string[]>()
    const nodeIncoming = new Map<string, string[]>()
    const inputIncoming = new Map<string, string[]>()
    const outputOutgoing = new Map<string, string[]>()

    for (const edge of edges) {
      const sourceNodeId = edge.source.nodeId
      const targetNodeId = edge.target.nodeId
      const outputId = edge.source.endpointId
      const inputId = edge.target.endpointId

      this.pushEdge(nodeOutgoing, sourceNodeId, edge.id)
      this.pushEdge(nodeIncoming, targetNodeId, edge.id)
      this.pushEdge(outputOutgoing, outputId, edge.id)
      this.pushEdge(inputIncoming, inputId, edge.id)
    }

    this.nodeMap = nodeMap
    this.edgeMap = edgeMap
    this.inputMap = endpointIndex.inputMap
    this.outputMap = endpointIndex.outputMap
    this.endpointMap = endpointIndex.endpointMap
    this.endpointOwner = endpointIndex.endpointOwner
    this.nodeEndpoints = endpointIndex.nodeEndpoints
    this.nodeOutgoing = nodeOutgoing
    this.nodeIncoming = nodeIncoming
    this.inputIncoming = inputIncoming
    this.outputOutgoing = outputOutgoing
  }

  /**
   * 从不可变 Graph 创建 GraphStore。
   *
   * @param graph - 图快照
   * @returns 图状态
   */
  static fromGraph(graph: Graph): GraphStore {
    return new GraphStore({ nodes: graph.nodes, edges: graph.edges, metadata: graph.metadata })
  }

  getNode(nodeId: string): Node | undefined {
    return this.nodeMap.get(nodeId)
  }

  getEdge(edgeId: string): Edge | undefined {
    return this.edgeMap.get(edgeId)
  }

  hasNode(nodeId: string): boolean {
    return this.nodeMap.has(nodeId)
  }

  hasEdge(edgeId: string): boolean {
    return this.edgeMap.has(edgeId)
  }

  hasEndpoint(endpointId: string): boolean {
    return this.endpointMap.has(endpointId)
  }

  getEndpoint(endpointId: string): Endpoint | undefined {
    return this.endpointMap.get(endpointId)
  }

  getInput(endpointId: string): Input | undefined {
    return this.inputMap.get(endpointId)
  }

  getOutput(endpointId: string): Output | undefined {
    return this.outputMap.get(endpointId)
  }

  getEndpointNodeId(endpointId: string): string | undefined {
    return this.endpointOwner.get(endpointId)
  }

  getNodeEndpoints(nodeId: string): readonly Endpoint[] {
    return this.nodeEndpoints.get(nodeId) ?? []
  }

  listNodes(): readonly Node[] {
    return [...this.nodeMap.values()]
  }

  listEdges(): readonly Edge[] {
    return [...this.edgeMap.values()]
  }

  getNodeOutgoing(nodeId: string): readonly Edge[] {
    const edgeIds = this.nodeOutgoing.get(nodeId) ?? []
    return edgeIds.map((edgeId) => this.edgeMap.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  getNodeIncoming(nodeId: string): readonly Edge[] {
    const edgeIds = this.nodeIncoming.get(nodeId) ?? []
    return edgeIds.map((edgeId) => this.edgeMap.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  getIncomingEdges(inputId: string): readonly Edge[] {
    const edgeIds = this.inputIncoming.get(inputId) ?? []
    return edgeIds.map((edgeId) => this.edgeMap.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  getOutgoingEdges(outputId: string): readonly Edge[] {
    const edgeIds = this.outputOutgoing.get(outputId) ?? []
    return edgeIds.map((edgeId) => this.edgeMap.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  /**
   * 将状态导出为不可变 Graph。
   *
   * @returns 图快照
   */
  toGraph(): Graph {
    return new Graph({ nodes: this.listNodes(), edges: this.listEdges(), metadata: this.metadata })
  }

  /**
   * 应用事实补丁，并返回回滚补丁。
   *
   * @param patch - 事实补丁
   * @returns 回滚补丁
   * @throws 当补丁引用不存在的实体、引入重复 ID 或包含冲突操作时抛出错误
   *
   * @example
   * const undo = store.apply({ edgeAdd: [edge] })
   * store.apply(undo)
   */
  apply(patch: Patch): UndoPatch {
    this.assertPatch(patch)

    const undo: UndoPatch = {}

    if (patch.nodeReplace) undo.nodeReplace = this.invertNodes(patch.nodeReplace)
    if (patch.edgeReplace) undo.edgeReplace = this.invertEdges(patch.edgeReplace)
    if (patch.edgeRemove) undo.edgeAdd = this.invertEdgeRemove(patch.edgeRemove)
    if (patch.nodeRemove) undo.nodeAdd = this.invertNodeRemove(patch.nodeRemove)
    if (patch.nodeAdd) undo.nodeRemove = patch.nodeAdd.map((node) => node.id)
    if (patch.edgeAdd) undo.edgeRemove = patch.edgeAdd.map((edge) => edge.id)

    this.applyNodeReplace(patch.nodeReplace)
    this.applyEdgeReplace(patch.edgeReplace)
    this.applyEdgeRemove(patch.edgeRemove)
    this.applyNodeRemove(patch.nodeRemove)
    this.applyNodeAdd(patch.nodeAdd)
    this.applyEdgeAdd(patch.edgeAdd)

    return undo
  }

  private assertPatch(patch: Patch): void {
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()

    this.trackIds(nodeIds, patch.nodeAdd?.map((node) => node.id))
    this.trackIds(nodeIds, patch.nodeRemove)
    this.trackIds(nodeIds, patch.nodeReplace?.map((node) => node.id))
    this.trackIds(edgeIds, patch.edgeAdd?.map((edge) => edge.id))
    this.trackIds(edgeIds, patch.edgeRemove)
    this.trackIds(edgeIds, patch.edgeReplace?.map((edge) => edge.id))
  }

  private trackIds(target: Set<string>, ids: readonly string[] | undefined): void {
    if (!ids) return
    for (const id of ids) {
      if (target.has(id)) throw new Error(`Conflicting patch id: ${id}`)
      target.add(id)
    }
  }

  private invertNodes(nodes: readonly Node[]): readonly Node[] {
    const next: Node[] = []
    for (const node of nodes) {
      const prev = this.nodeMap.get(node.id)
      if (!prev) throw new Error(`Missing node id for replace: ${node.id}`)
      next.push(prev)
    }
    return Object.freeze(next)
  }

  private invertEdges(edges: readonly Edge[]): readonly Edge[] {
    const next: Edge[] = []
    for (const edge of edges) {
      const prev = this.edgeMap.get(edge.id)
      if (!prev) throw new Error(`Missing edge id for replace: ${edge.id}`)
      next.push(prev)
    }
    return Object.freeze(next)
  }

  private invertEdgeRemove(edgeIds: readonly string[]): readonly Edge[] {
    const next: Edge[] = []
    for (const edgeId of edgeIds) {
      const edge = this.edgeMap.get(edgeId)
      if (!edge) throw new Error(`Missing edge id for remove: ${edgeId}`)
      next.push(edge)
    }
    return Object.freeze(next)
  }

  private invertNodeRemove(nodeIds: readonly string[]): readonly Node[] {
    const next: Node[] = []
    for (const nodeId of nodeIds) {
      const node = this.nodeMap.get(nodeId)
      if (!node) throw new Error(`Missing node id for remove: ${nodeId}`)
      next.push(node)
    }
    return Object.freeze(next)
  }

  private applyNodeReplace(nodes: readonly Node[] | undefined): void {
    if (!nodes) return
    for (const node of nodes) this.replaceNode(node)
  }

  private applyEdgeReplace(edges: readonly Edge[] | undefined): void {
    if (!edges) return
    for (const edge of edges) this.replaceEdge(edge)
  }

  private applyEdgeRemove(edgeIds: readonly string[] | undefined): void {
    if (!edgeIds) return
    for (const edgeId of edgeIds) this.removeEdge(edgeId)
  }

  private applyNodeRemove(nodeIds: readonly string[] | undefined): void {
    if (!nodeIds) return
    for (const nodeId of nodeIds) this.removeNode(nodeId)
  }

  private applyNodeAdd(nodes: readonly Node[] | undefined): void {
    if (!nodes) return
    for (const node of nodes) this.addNode(node)
  }

  private applyEdgeAdd(edges: readonly Edge[] | undefined): void {
    if (!edges) return
    for (const edge of edges) this.addEdge(edge)
  }

  private pushEdge(listMap: Map<string, string[]>, key: string, edgeId: string): void {
    const list = listMap.get(key)
    if (list) {
      list.push(edgeId)
      return
    }
    listMap.set(key, [edgeId])
  }

  private addNode(node: Node): void {
    if (this.nodeMap.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`)
    this.nodeMap.set(node.id, node)
    this.indexNode(node)
  }

  private replaceNode(node: Node): void {
    const prev = this.nodeMap.get(node.id)
    if (!prev) throw new Error(`Missing node id for replace: ${node.id}`)
    this.unindexNode(prev, node)
    this.nodeMap.set(node.id, node)
    this.indexNode(node)
  }

  private removeNode(nodeId: string): void {
    const node = this.nodeMap.get(nodeId)
    if (!node) throw new Error(`Missing node id for remove: ${nodeId}`)

    const outgoing = this.nodeOutgoing.get(nodeId)
    if (outgoing && outgoing.length > 0) throw new Error(`Node has outgoing edges: ${nodeId}`)
    const incoming = this.nodeIncoming.get(nodeId)
    if (incoming && incoming.length > 0) throw new Error(`Node has incoming edges: ${nodeId}`)

    this.unindexNode(node)
    this.nodeMap.delete(nodeId)
  }

  private addEdge(edge: Edge): void {
    if (this.edgeMap.has(edge.id)) throw new Error(`Duplicate edge id: ${edge.id}`)
    this.edgeMap.set(edge.id, edge)
    this.indexEdge(edge)
  }

  private replaceEdge(edge: Edge): void {
    const prev = this.edgeMap.get(edge.id)
    if (!prev) throw new Error(`Missing edge id for replace: ${edge.id}`)
    this.unindexEdge(prev)
    this.edgeMap.set(edge.id, edge)
    this.indexEdge(edge)
  }

  private removeEdge(edgeId: string): void {
    const edge = this.edgeMap.get(edgeId)
    if (!edge) throw new Error(`Missing edge id for remove: ${edgeId}`)
    this.unindexEdge(edge)
    this.edgeMap.delete(edgeId)
  }

  private indexNode(node: Node): void {
    const endpoints: Endpoint[] = []

    for (const input of node.inputs) {
      if (this.endpointMap.has(input.id)) throw new Error(`Duplicate endpoint id: ${input.id}`)
      this.inputMap.set(input.id, input)
      this.endpointMap.set(input.id, input)
      this.endpointOwner.set(input.id, node.id)
      endpoints.push(input)
    }

    for (const output of node.outputs) {
      if (this.endpointMap.has(output.id)) throw new Error(`Duplicate endpoint id: ${output.id}`)
      this.outputMap.set(output.id, output)
      this.endpointMap.set(output.id, output)
      this.endpointOwner.set(output.id, node.id)
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
      this.inputMap.delete(input.id)
      this.endpointMap.delete(input.id)
      this.endpointOwner.delete(input.id)

      if (!isKept) {
        const incoming = this.inputIncoming.get(input.id)
        if (incoming && incoming.length > 0) throw new Error(`Input has edges: ${input.id}`)
        this.inputIncoming.delete(input.id)
      }
    }

    for (const output of node.outputs) {
      const isKept = nextEndpointIdSet?.has(output.id) === true
      this.outputMap.delete(output.id)
      this.endpointMap.delete(output.id)
      this.endpointOwner.delete(output.id)

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
    const last = list.pop()
    if (last === undefined) return
    if (index < list.length) list[index] = last
  }
}

interface EndpointIndex {
  inputMap: Map<string, Input>
  outputMap: Map<string, Output>
  endpointMap: Map<string, Endpoint>
  endpointOwner: Map<string, string>
  nodeEndpoints: Map<string, readonly Endpoint[]>
}

function indexEndpoints(nodes: readonly Node[]): EndpointIndex {
  const inputMap = new Map<string, Input>()
  const outputMap = new Map<string, Output>()
  const endpointMap = new Map<string, Endpoint>()
  const endpointOwner = new Map<string, string>()
  const nodeEndpoints = new Map<string, readonly Endpoint[]>()

  for (const node of nodes) {
    const endpoints: Endpoint[] = []
    for (const input of node.inputs) {
      if (endpointMap.has(input.id)) throw new Error(`Duplicate endpoint id: ${input.id}`)
      inputMap.set(input.id, input)
      endpointMap.set(input.id, input)
      endpointOwner.set(input.id, node.id)
      endpoints.push(input)
    }
    for (const output of node.outputs) {
      if (endpointMap.has(output.id)) throw new Error(`Duplicate endpoint id: ${output.id}`)
      outputMap.set(output.id, output)
      endpointMap.set(output.id, output)
      endpointOwner.set(output.id, node.id)
      endpoints.push(output)
    }
    nodeEndpoints.set(node.id, Object.freeze(endpoints))
  }

  return { inputMap, outputMap, endpointMap, endpointOwner, nodeEndpoints }
}
