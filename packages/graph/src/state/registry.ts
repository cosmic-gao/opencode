import type { Edge, Endpoint, Input, Node, Output } from '../model'

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

  constructor(nodes: readonly Node[] = [], edges: readonly Edge[] = []) {
    for (const node of nodes) {
      this.addNode(node)
    }
    for (const edge of edges) {
      this.addEdge(edge)
    }
  }

  getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId)
  }

  getEdge(edgeId: string): Edge | undefined {
    return this.edges.get(edgeId)
  }

  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId)
  }

  hasEdge(edgeId: string): boolean {
    return this.edges.has(edgeId)
  }

  hasEndpoint(endpointId: string): boolean {
    return this.endpoints.has(endpointId)
  }

  getEndpoint(endpointId: string): Endpoint | undefined {
    return this.endpoints.get(endpointId)
  }

  getInput(endpointId: string): Input | undefined {
    return this.inputs.get(endpointId)
  }

  getOutput(endpointId: string): Output | undefined {
    return this.outputs.get(endpointId)
  }

  owner(endpointId: string): string | undefined {
    return this.owners.get(endpointId)
  }

  endpointsOf(nodeId: string): readonly Endpoint[] {
    return this.nodeEndpoints.get(nodeId) ?? []
  }

  listNodes(): readonly Node[] {
    return [...this.nodes.values()]
  }

  listEdges(): readonly Edge[] {
    return [...this.edges.values()]
  }

  outgoing(nodeId: string): readonly Edge[] {
    const edgeIds = this.nodeOutgoing.get(nodeId) ?? []
    return edgeIds.map((edgeId) => this.edges.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  incoming(nodeId: string): readonly Edge[] {
    const edgeIds = this.nodeIncoming.get(nodeId) ?? []
    return edgeIds.map((edgeId) => this.edges.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  inputEdges(inputId: string): readonly Edge[] {
    const edgeIds = this.inputIncoming.get(inputId) ?? []
    return edgeIds.map((edgeId) => this.edges.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  outputEdges(outputId: string): readonly Edge[] {
    const edgeIds = this.outputOutgoing.get(outputId) ?? []
    return edgeIds.map((edgeId) => this.edges.get(edgeId)).filter((edge): edge is Edge => Boolean(edge))
  }

  addNode(node: Node): void {
    if (this.nodes.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`)
    this.nodes.set(node.id, node)
    this.indexNode(node)
  }

  replaceNode(node: Node): void {
    const prev = this.nodes.get(node.id)
    if (!prev) throw new Error(`Missing node id for replace: ${node.id}`)
    this.unindexNode(prev, node)
    this.nodes.set(node.id, node)
    this.indexNode(node)
  }

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

  addEdge(edge: Edge): void {
    if (this.edges.has(edge.id)) throw new Error(`Duplicate edge id: ${edge.id}`)
    this.edges.set(edge.id, edge)
    this.indexEdge(edge)
  }

  replaceEdge(edge: Edge): void {
    const prev = this.edges.get(edge.id)
    if (!prev) throw new Error(`Missing edge id for replace: ${edge.id}`)
    this.unindexEdge(prev)
    this.edges.set(edge.id, edge)
    this.indexEdge(edge)
  }

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
    const last = list.pop()
    if (last === undefined) return
    if (index < list.length) list[index] = last
  }
}
