import type { Edge } from '../model/edge'
import type { Endpoint } from '../model/endpoint'
import type { GraphDefinition } from '../model/graph-definition'
import type { Input } from '../model/input'
import type { Node } from '../model/node'
import type { Output } from '../model/output'
import type { LookupSnapshot } from './incremental'
import type { LookupView } from './view'

/**
 * 查表对象 (Lookup)
 *
 * 为 Graph 提供基于 Map 的高性能索引，将 O(n) 的数组扫描转换为 O(1) 的哈希查找。
 * 它是不可变的（Immutable），在构造时一次性计算所有索引，之后仅供查询。
 *
 * 主要索引：
 * - ID 映射：Node/Edge/Endpoint ID -> 对象实例
 * - 归属映射：Endpoint ID -> Node ID
 * - 邻接表：Node/Endpoint -> 进出边列表
 */
export class Lookup implements LookupView {
  // --- 基础 ID 索引 ---
  private readonly nodeById: Map<string, Node>
  private readonly inputById: Map<string, Input>
  private readonly outputById: Map<string, Output>
  private readonly endpointById: Map<string, Endpoint>
  private readonly edgeById: Map<string, Edge>

  // --- 关系索引 ---
  private readonly endpointOwners: Map<string, string>
  
  // 辅助构建的中间 ID 列表，用于最终生成只读的 Edge 数组
  private readonly inputEdgeIds: Map<string, string[]>
  private readonly outputEdgeIds: Map<string, string[]>
  private readonly nodeIncomingIds: Map<string, string[]>
  private readonly nodeOutgoingIds: Map<string, string[]>

  // --- 最终暴露的只读邻接表 ---
  private readonly nodeEndpoints: Map<string, readonly Endpoint[]>
  private readonly inputEdges: Map<string, readonly Edge[]>
  private readonly outputEdges: Map<string, readonly Edge[]>
  private readonly nodeIncoming: Map<string, readonly Edge[]>
  private readonly nodeOutgoing: Map<string, readonly Edge[]>

  /**
   * 创建 Lookup 实例。
   *
   * 构造函数会遍历 Graph 的所有节点和边，构建完整的索引映射。
   * 或者从现有的快照 (Snapshot) 直接恢复索引状态。
   *
   * @param source - 图定义对象 (GraphDefinition) 或 索引快照 (LookupSnapshot)
   */
  constructor(source: GraphDefinition | LookupSnapshot) {
    // 预初始化属性，避免 TS 报错（虽然在 helper 中初始化）
    this.nodeById = new Map()
    this.inputById = new Map()
    this.outputById = new Map()
    this.endpointById = new Map()
    this.edgeById = new Map()
    this.endpointOwners = new Map()
    this.inputEdgeIds = new Map()
    this.outputEdgeIds = new Map()
    this.nodeIncomingIds = new Map()
    this.nodeOutgoingIds = new Map()
    this.nodeEndpoints = new Map()
    this.inputEdges = new Map()
    this.outputEdges = new Map()
    this.nodeIncoming = new Map()
    this.nodeOutgoing = new Map()

    if (this.isSnapshot(source)) {
      this.initFromSnapshot(source)
    } else {
      this.initFromDefinition(source)
    }
  }

  private isSnapshot(source: GraphDefinition | LookupSnapshot): source is LookupSnapshot {
    return (source as any).nodeById instanceof Map
  }

  static fromSnapshot(snapshot: LookupSnapshot): Lookup {
    return new Lookup(snapshot)
  }

  // --- 初始化辅助方法 ---

  private initFromSnapshot(source: LookupSnapshot): void {
    // 使用 Object.assign 或直接赋值？直接赋值
    // 必须 cast this to mutable or ignore readonly for init
    const self = this as any
    self.nodeById = source.nodeById
    self.inputById = source.inputById
    self.outputById = source.outputById
    self.endpointById = source.endpointById
    self.edgeById = source.edgeById
    self.endpointOwners = source.endpointOwners
    self.nodeEndpoints = source.nodeEndpoints
    
    self.inputEdgeIds = source.inputEdges
    self.outputEdgeIds = source.outputEdges
    self.nodeIncomingIds = source.nodeIncoming
    self.nodeOutgoingIds = source.nodeOutgoing

    // 构建最终的 Edge 列表
    this.finalizeEdges(this.inputEdgeIds, this.inputEdges)
    this.finalizeEdges(this.outputEdgeIds, this.outputEdges)
    this.finalizeEdges(this.nodeIncomingIds, this.nodeIncoming)
    this.finalizeEdges(this.nodeOutgoingIds, this.nodeOutgoing)
  }

  private initFromDefinition(graph: GraphDefinition): void {
    this.indexNodes(graph)
    this.indexEdges(graph)
    this.finalizeAllEdges()
  }

  private indexNodes(graph: GraphDefinition): void {
    for (const node of graph.nodes) {
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

      this.nodeEndpoints.set(node.id, Object.freeze(endpoints))
    }
  }

  private indexEdges(graph: GraphDefinition): void {
    for (const edge of graph.edges) {
      this.edgeById.set(edge.id, edge)

      this.ensureEdgeList(this.outputEdgeIds, edge.source.endpointId).push(edge.id)
      this.ensureEdgeList(this.inputEdgeIds, edge.target.endpointId).push(edge.id)
      this.ensureEdgeList(this.nodeOutgoingIds, edge.source.nodeId).push(edge.id)
      this.ensureEdgeList(this.nodeIncomingIds, edge.target.nodeId).push(edge.id)
    }
  }

  private finalizeAllEdges(): void {
    this.finalizeEdges(this.inputEdgeIds, this.inputEdges)
    this.finalizeEdges(this.outputEdgeIds, this.outputEdges)
    this.finalizeEdges(this.nodeIncomingIds, this.nodeIncoming)
    this.finalizeEdges(this.nodeOutgoingIds, this.nodeOutgoing)
  }

  private ensureEdgeList(map: Map<string, string[]>, key: string): string[] {
    let list = map.get(key)
    if (!list) {
      list = []
      map.set(key, list)
    }
    return list
  }

  // --- 查询接口实现 ---

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
    return this.inputEdgeIds.get(inputId) ?? []
  }

  getOutgoingIds(outputId: string): readonly string[] {
    return this.outputEdgeIds.get(outputId) ?? []
  }

  getIncomingCount(inputId: string): number {
    return this.inputEdgeIds.get(inputId)?.length ?? 0
  }

  getOutgoingCount(outputId: string): number {
    return this.outputEdgeIds.get(outputId)?.length ?? 0
  }

  getIncomingEdges(inputId: string): readonly Edge[] {
    return this.inputEdges.get(inputId) ?? []
  }

  getOutgoingEdges(outputId: string): readonly Edge[] {
    return this.outputEdges.get(outputId) ?? []
  }

  getNodeIncoming(nodeId: string): readonly Edge[] {
    return this.nodeIncoming.get(nodeId) ?? []
  }

  getNodeOutgoing(nodeId: string): readonly Edge[] {
    return this.nodeOutgoing.get(nodeId) ?? []
  }

  private finalizeEdges(
    source: Map<string, string[]>,
    target: Map<string, readonly Edge[]>
  ) {
    for (const [key, edgeIds] of source) {
      target.set(key, Object.freeze(this.getEdges(edgeIds)))
    }
  }

  private getEdges(edgeIds: readonly string[]): Edge[] {
    const edges: Edge[] = []
    for (const edgeId of edgeIds) {
      const edge = this.edgeById.get(edgeId)
      if (edge) edges.push(edge)
    }
    return edges
  }
}
