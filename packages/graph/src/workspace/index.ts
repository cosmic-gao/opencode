import { Graph } from '../model/graph'
import { Lookup } from '../lookup'
import type { Edge } from '../model/edge'
import type { Node } from '../model/node'
import type { GraphDelta } from '../delta'
import { IncrementalLookup } from '../lookup/incremental'
import type { ImpactOptions } from '../subgraph/affected'
import {
  collectAffected,
  createSubgraph,
} from '../subgraph/affected'
import type { Subgraph } from '../subgraph/instance'

/**
 * 变更应用结果
 */
export interface ApplyResult {
  /** 生成的新图快照 */
  graph: Graph
  /** 更新后的增量索引（引用） */
  lookup: IncrementalLookup
  /** 受本次变更影响的子图 */
  affected: Subgraph
}

/**
 * 图工作区 (GraphWorkspace)
 *
 * 用于管理图的编辑会话。它维护了一个可变的图状态（通过 IncrementalLookup 和数组），
 * 并支持事务性地应用变更 (GraphDelta)，生成新的不可变 Graph 快照。
 *
 * 核心优化：
 * - 维护增量索引，避免每次变更都全量重建。
 * - 生成新 Graph 时，复用增量索引的状态（通过快照），实现 O(1) 的 Graph 创建开销（相对于索引构建）。
 *
 * @example
 * ```ts
 * // 1. 创建初始图
 * const initialGraph = new Graph({ nodes: [], edges: [] });
 *
 * // 2. 初始化工作区
 * const workspace = new GraphWorkspace(initialGraph);
 *
 * // 3. 定义变更
 * const delta = {
 *   addedNodes: [
 *     new Node({ id: 'node1', type: 'core', inputs: [], outputs: [] })
 *   ]
 * };
 *
 * // 4. 应用变更
 * const result = workspace.apply(delta);
 * console.log(result.graph.nodes.length); // 1
 * ```
 */
export class GraphWorkspace {
  private readonly nodeIndexByIdMap = new Map<string, number>()
  private readonly edgeIndexByIdMap = new Map<string, number>()
  private readonly nodes: Node[] = []
  private readonly edges: Edge[] = []

  readonly lookup: IncrementalLookup
  graph: Graph

  /**
   * 创建工作区。
   *
   * @param graph - 初始图状态
   */
  constructor(graph: Graph) {
    this.graph = graph

    for (const node of graph.nodes) this.addNode(node)
    for (const edge of graph.edges) this.addEdge(edge)

    this.lookup = new IncrementalLookup(graph)
  }

  /**
   * 应用变更并生成新图。
   *
   * @param delta - 变更描述
   * @param options - 受影响子图分析选项
   * @returns 包含新图、当前 lookup 引用及受影响子图的结果对象
   *
   * @example
   * ```ts
   * const delta = {
   *   removedNodeIds: ['node-to-delete']
   * };
   *
   * // 应用变更并分析受影响的下游节点
   * const { graph, affected } = workspace.apply(delta, {
   *   direction: 'downstream'
   * });
   *
   * console.log('New graph node count:', graph.nodes.length);
   * console.log('Affected nodes:', affected.nodes.map(n => n.id));
   * ```
   */
  apply(delta: GraphDelta, options: ImpactOptions = {}): ApplyResult {
    const effectiveDelta = this.normalizeDelta(delta)
    const affectedNodeIds = collectAffected(this.lookup, effectiveDelta, options)

    this.applyArrays(effectiveDelta)
    this.lookup.apply(effectiveDelta)

    // 关键优化：从 IncrementalLookup 获取快照，直接构建 Lookup，避免重建索引。
    const fastLookup = Lookup.fromSnapshot(this.lookup.getSnapshot())

    this.graph = new Graph({ 
      nodes: this.nodes, 
      edges: this.edges,
      lookup: fastLookup
    })

    const affected = createSubgraph(this.lookup, affectedNodeIds, options)

    return { graph: this.graph, lookup: this.lookup, affected }
  }

  private normalizeDelta(delta: GraphDelta): GraphDelta {
    if (!delta.removedNodeIds || delta.removedNodeIds.length === 0) return delta

    const removedEdgeIdSet = new Set<string>(delta.removedEdgeIds ?? [])

    for (const nodeId of delta.removedNodeIds) {
      this.collectEdges(nodeId, removedEdgeIdSet)
    }

    return {
      ...delta,
      removedEdgeIds: [...removedEdgeIdSet],
    }
  }

  private collectEdges(nodeId: string, edgeIdSet: Set<string>): void {
    for (const edge of this.lookup.getNodeIncoming(nodeId)) {
      edgeIdSet.add(edge.id)
    }
    for (const edge of this.lookup.getNodeOutgoing(nodeId)) {
      edgeIdSet.add(edge.id)
    }
  }

  private applyArrays(delta: GraphDelta): void {
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

  private addNode(node: Node): void {
    if (this.nodeIndexByIdMap.has(node.id)) return
    this.nodeIndexByIdMap.set(node.id, this.nodes.length)
    this.nodes.push(node)
  }

  private addEdge(edge: Edge): void {
    if (this.edgeIndexByIdMap.has(edge.id)) return
    this.edgeIndexByIdMap.set(edge.id, this.edges.length)
    this.edges.push(edge)
  }

  private removeNode(nodeId: string): void {
    const index = this.nodeIndexByIdMap.get(nodeId)
    if (index === undefined) return
    this.removeFromArray(this.nodes, index, this.nodeIndexByIdMap)
    this.nodeIndexByIdMap.delete(nodeId)
  }

  private removeEdge(edgeId: string): void {
    const index = this.edgeIndexByIdMap.get(edgeId)
    if (index === undefined) return
    this.removeFromArray(this.edges, index, this.edgeIndexByIdMap)
    this.edgeIndexByIdMap.delete(edgeId)
  }

  private removeFromArray<T extends { id: string }>(
    array: T[],
    index: number,
    indexMap: Map<string, number>
  ): void {
    const lastIndex = array.length - 1
    if (index !== lastIndex) {
      const swapped = array[lastIndex]
      if (swapped) {
        array[index] = swapped
        indexMap.set(swapped.id, index)
      }
    }
    array.pop()
  }
}
