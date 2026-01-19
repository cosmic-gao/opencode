import { type EdgeValue, Edge } from './edge'
import { type NodeValue, Node } from './node'

/**
 * 图数据持久化结构
 */
export interface GraphValue {
  nodes: NodeValue[]
  edges: EdgeValue[]
  metadata?: Record<string, unknown>
}

/**
 * 构造图对象的选项
 */
export interface GraphOptions {
  nodes?: readonly Node[]
  edges?: readonly Edge[]
  metadata?: Record<string, unknown>
}

/**
 * 图 (Graph)
 *
 * 图是节点 (Node) 和边 (Edge) 的不可变集合。
 * 它是 Graph 引擎的核心数据容器，负责维护数据的完整性与一致性。
 *
 * 主要特性：
 * - **不可变性 (Immutable)**：节点和边列表在创建后即被冻结，变更需通过生成新实例实现。
 * - **高性能索引 (Lookup)**：通过继承 GraphDefinition，自动获得基于 Map 的 O(1) 查询能力。
 * - **可序列化 (Serializable)**：支持与 JSON 结构 (GraphValue) 的相互转换。
 */
export class Graph {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
  readonly metadata?: Record<string, unknown>

  /**
   * 创建一个图实例。
   *
   * @param options - 初始化选项，包含节点、边、元数据及可选的预构建 Lookup
   */
  constructor(options: GraphOptions) {
    this.nodes = Object.freeze([...(options.nodes ?? [])])
    this.edges = Object.freeze([...(options.edges ?? [])])
    this.metadata = options.metadata
  }

  /**
   * 从持久化结构创建图对象。
   *
   * @param value - 图持久化结构 (GraphValue)
   * @returns 图对象实例
   *
   * @example
   * const graph = Graph.fromValue({
   *   nodes: [{ id: 'n1', type: 'task', inputs: [], outputs: [] }],
   *   edges: []
   * });
   */
  static fromValue(value: GraphValue): Graph {
    return new Graph({
      nodes: value.nodes.map((node) => Node.fromValue(node)),
      edges: value.edges.map((edge) => Edge.fromValue(edge)),
      metadata: value.metadata,
    })
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 图持久化结构 (GraphValue)
   *
   * @example
   * const value = graph.toValue();
   * console.log(JSON.stringify(value));
   */
  toValue(): GraphValue {
    return {
      nodes: this.nodes.map((node) => node.toValue()),
      edges: this.edges.map((edge) => edge.toValue()),
      metadata: this.metadata,
    }
  }
}
