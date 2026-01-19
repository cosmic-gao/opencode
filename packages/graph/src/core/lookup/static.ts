import type { Edge, Endpoint, Graph, Input, Node, Output } from '../model'
import type { Scope } from './scope'

/**
 * 查表对象 (Static)
 *
 * 为 Graph 提供基于 Map 的高性能索引，将 O(n) 的数组扫描转换为 O(1) 的哈希查找。
 * 它是不可变的（Immutable），在构造时一次性计算所有索引，之后仅供查询。
 *
 * 主要索引：
 * - ID 映射：Node/Edge/Endpoint ID -> 对象实例
 * - 归属映射：Endpoint ID -> Node ID
 * - 邻接表：Node/Endpoint -> 进出边列表
 */
export class Static implements Scope {
  // --- 基础 ID 索引 ---
  private readonly nodes: Map<string, Node>
  private readonly inputs: Map<string, Input>
  private readonly outputs: Map<string, Output>
  private readonly allEndpoints: Map<string, Endpoint>
  private readonly edges: Map<string, Edge>

  // --- 关系索引 ---
  private readonly owners: Map<string, string>

  // 辅助构建的中间 ID 列表，用于最终生成只读的 Edge 数组
  private readonly inputRefs: Map<string, string[]>
  private readonly outputRefs: Map<string, string[]>
  private readonly incomingRefs: Map<string, string[]>
  private readonly outgoingRefs: Map<string, string[]>

  // --- 最终暴露的只读邻接表 ---
  private readonly nodeEndpoints: Map<string, readonly Endpoint[]>
  private readonly inputEdgeMap: Map<string, readonly Edge[]>
  private readonly outputEdgeMap: Map<string, readonly Edge[]>
  private readonly nodeIncoming: Map<string, readonly Edge[]>
  private readonly nodeOutgoing: Map<string, readonly Edge[]>

  /**
   * 创建 Static 实例。
   *
   * 构造函数会遍历 Graph 的所有节点和边，构建完整的索引映射。
   *
   * @param graph - 图定义对象 (Graph)
   */
  constructor(graph: Graph) {
    // 预初始化属性，避免 TS 报错（虽然在 helper 中初始化）
    this.nodes = new Map()
    this.inputs = new Map()
    this.outputs = new Map()
    this.allEndpoints = new Map()
    this.edges = new Map()
    this.owners = new Map()
    this.inputRefs = new Map()
    this.outputRefs = new Map()
    this.incomingRefs = new Map()
    this.outgoingRefs = new Map()
    this.nodeEndpoints = new Map()
    this.inputEdgeMap = new Map()
    this.outputEdgeMap = new Map()
    this.nodeIncoming = new Map()
    this.nodeOutgoing = new Map()


    this.init(graph)
  }

  // --- 初始化辅助方法 ---

  private init(graph: Graph): void {
    this.loadNodes(graph)
    this.loadEdges(graph)
    this.finalize()
  }

  private loadNodes(graph: Graph): void {
    for (const node of graph.nodes) {
      this.nodes.set(node.id, node)

      const endpoints: Endpoint[] = []

      for (const input of node.inputs) {
        this.inputs.set(input.id, input)
        this.allEndpoints.set(input.id, input)
        this.owners.set(input.id, node.id)
        endpoints.push(input)
      }

      for (const output of node.outputs) {
        this.outputs.set(output.id, output)
        this.allEndpoints.set(output.id, output)
        this.owners.set(output.id, node.id)
        endpoints.push(output)
      }

      this.nodeEndpoints.set(node.id, Object.freeze(endpoints))
    }
  }

  private loadEdges(graph: Graph): void {
    for (const edge of graph.edges) {
      this.edges.set(edge.id, edge)

      this.ensure(this.outputRefs, edge.source.endpointId).push(edge.id)
      this.ensure(this.inputRefs, edge.target.endpointId).push(edge.id)
      this.ensure(this.outgoingRefs, edge.source.nodeId).push(edge.id)
      this.ensure(this.incomingRefs, edge.target.nodeId).push(edge.id)
    }
  }

  private finalize(): void {
    this.resolve(this.inputRefs, this.inputEdgeMap)
    this.resolve(this.outputRefs, this.outputEdgeMap)
    this.resolve(this.incomingRefs, this.nodeIncoming)
    this.resolve(this.outgoingRefs, this.nodeOutgoing)
  }


  private ensure(map: Map<string, string[]>, key: string): string[] {
    let list = map.get(key)
    if (!list) {
      list = []
      map.set(key, list)
    }
    return list
  }

  // --- 查询接口实现 ---

  hasNode(id: string): boolean {
    return this.nodes.has(id)
  }

  hasEdge(id: string): boolean {
    return this.edges.has(id)
  }

  hasEndpoint(id: string): boolean {
    return this.allEndpoints.has(id)
  }

  getNode(id: string): Node | undefined {
    return this.nodes.get(id)
  }

  getEdge(id: string): Edge | undefined {
    return this.edges.get(id)
  }

  getEndpoint(id: string): Endpoint | undefined {
    return this.allEndpoints.get(id)
  }

  getInput(id: string): Input | undefined {
    return this.inputs.get(id)
  }

  getOutput(id: string): Output | undefined {
    return this.outputs.get(id)
  }

  owner(endpointId: string): string | undefined {
    return this.owners.get(endpointId)
  }

  endpoints(nodeId: string): readonly Endpoint[] {
    return this.nodeEndpoints.get(nodeId) ?? []
  }

  inputIds(inputId: string): readonly string[] {
    return this.inputRefs.get(inputId) ?? []
  }

  outputIds(outputId: string): readonly string[] {
    return this.outputRefs.get(outputId) ?? []
  }

  inputCount(inputId: string): number {
    return this.inputRefs.get(inputId)?.length ?? 0
  }

  outputCount(outputId: string): number {
    return this.outputRefs.get(outputId)?.length ?? 0
  }

  inputEdges(inputId: string): IterableIterator<Edge> {
    return (this.inputEdgeMap.get(inputId) ?? []).values()
  }

  outputEdges(outputId: string): IterableIterator<Edge> {
    return (this.outputEdgeMap.get(outputId) ?? []).values()
  }


  incoming(nodeId: string): IterableIterator<Edge> {
    return (this.nodeIncoming.get(nodeId) ?? []).values()
  }

  outgoing(nodeId: string): IterableIterator<Edge> {
    return (this.nodeOutgoing.get(nodeId) ?? []).values()
  }


  private resolve(
    source: Map<string, string[]>,
    target: Map<string, readonly Edge[]>
  ) {
    for (const [key, edgeIds] of source) {
      target.set(key, Object.freeze(this.lookup(edgeIds)))
    }
  }

  private lookup(edgeIds: readonly string[]): Edge[] {
    const edges: Edge[] = []
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId)
      if (edge) edges.push(edge)
    }
    return edges
  }
}