import { produce, enableMapSet, immerable } from 'immer'
import { type EdgeValue, Edge } from './edge'
import { type NodeValue, Node } from './node'
import type { Patch } from '../state'

// 启用 Immer 的 Map/Set 支持
enableMapSet()

/**
 * 图数据持久化结构
 */
export interface GraphValue<T = unknown> {
  nodes: NodeValue[]
  edges: EdgeValue[]
  metadata?: T
}

/**
 * 构造图对象的选项
 */
export interface GraphOptions<T = Record<string, unknown>> {
  nodes?: ReadonlyMap<string, Node> | Iterable<Node>
  edges?: ReadonlyMap<string, Edge> | Iterable<Edge>
  metadata?: T
}

/**
 * 图 (Graph)
 *
 * 图是节点 (Node) 和边 (Edge) 的不可变集合。
 * 它是 Graph 引擎的核心数据容器，负责维护数据的完整性与一致性。
 *
 * 主要特性：
 * - **不可变性 (Immutable)**：基于 Immer 实现，支持结构共享。
 * - **高性能**：内部使用 Map 存储，支持 O(1) 查找和 O(1) 快照。
 * - **高级操作**：原生支持剪枝 (prune) 和嫁接 (merge)。
 */
export class Graph<T = Record<string, unknown>> {
  /** 节点集合 (不可变 Map) */
  readonly nodes: ReadonlyMap<string, Node>
  /** 边集合 (不可变 Map) */
  readonly edges: ReadonlyMap<string, Edge>
  /** 元数据 */
  readonly metadata?: T

  /**
   * 创建一个图实例。
   *
   * @param options - 初始化选项
   */
  constructor(options: GraphOptions<T> = {}) {
    if (options.nodes instanceof Map) {
      this.nodes = options.nodes
    } else {
      this.nodes = new Map(
        Array.from((options.nodes ?? []) as Iterable<Node>).map(n => [n.id, n])
      )
    }

    if (options.edges instanceof Map) {
      this.edges = options.edges
    } else {
      this.edges = new Map(
        Array.from((options.edges ?? []) as Iterable<Edge>).map(e => [e.id, e])
      )
    }
      
    this.metadata = options.metadata
  }

  /**
   * 应用事实补丁 (Patch)。
   * 
   * 基于当前图状态，应用增量补丁并返回新的图实例。
   * 利用 Immer 实现结构共享。
   *
   * @param patch - 事实补丁
   * @returns 新的图实例
   */
  patch(patch: Patch): Graph<T> {
    return produce(this, (draft: Graph<T>) => {
      const nodes = draft.nodes as Map<string, Node>
      const edges = draft.edges as Map<string, Edge>

      // 1. Remove
      if (patch.edgeRemove) {
        for (const id of patch.edgeRemove) edges.delete(id)
      }
      if (patch.nodeRemove) {
        for (const id of patch.nodeRemove) nodes.delete(id)
      }

      // 2. Add
      if (patch.nodeAdd) {
        for (const node of patch.nodeAdd) nodes.set(node.id, node)
      }
      if (patch.edgeAdd) {
        for (const edge of patch.edgeAdd) edges.set(edge.id, edge)
      }

      // 3. Replace
      if (patch.nodeReplace) {
        for (const node of patch.nodeReplace) {
          if (nodes.has(node.id)) nodes.set(node.id, node)
        }
      }
      if (patch.edgeReplace) {
        for (const edge of patch.edgeReplace) {
          if (edges.has(edge.id)) edges.set(edge.id, edge)
        }
      }
    })
  }

  /**
   * 剪枝 (Prune)。
   * 
   * 根据指定条件保留节点，并自动移除相关的边。
   * 
   * @param predicate - 节点筛选函数，返回 true 保留，false 移除
   * @returns 剪枝后的新图实例
   * 
   * @example
   * const subgraph = graph.prune(node => node.type === 'task');
   */
  prune(predicate: (node: Node) => boolean): Graph<T> {
    return produce(this, (draft: Graph<T>) => {
      const nodes = draft.nodes as Map<string, Node>
      const edges = draft.edges as Map<string, Edge>
      
      // 移除不符合条件的节点
      for (const [id, node] of nodes) {
        if (!predicate(node)) {
          nodes.delete(id)
        }
      }

      // 移除连接到已删除节点的边
      for (const [id, edge] of edges) {
        if (!nodes.has(edge.source.nodeId) || !nodes.has(edge.target.nodeId)) {
          edges.delete(id)
        }
      }
    })
  }

  /**
   * 嫁接 (Merge)。
   * 
   * 将另一个图的节点和边合并到当前图中。
   * 如果 ID 冲突，来自 other 图的元素将覆盖当前图的元素。
   * 
   * @param other - 要合并的图
   * @returns 合并后的新图实例
   * 
   * @example
   * const merged = mainGraph.merge(subgraph);
   */
  merge(other: Graph<T>): Graph<T> {
    return produce(this, (draft: Graph<T>) => {
      const nodes = draft.nodes as Map<string, Node>
      const edges = draft.edges as Map<string, Edge>

      for (const [id, node] of other.nodes) {
        nodes.set(id, node)
      }
      for (const [id, edge] of other.edges) {
        edges.set(id, edge)
      }
    })
  }

  /**
   * 从持久化结构创建图对象。
   *
   * @param value - 图持久化结构 (GraphValue)
   * @returns 图对象实例
   */
  static fromValue<T = Record<string, unknown>>(value: GraphValue<T>): Graph<T> {
    return new Graph<T>({
      nodes: value.nodes.map((node) => Node.fromValue(node)),
      edges: value.edges.map((edge) => Edge.fromValue(edge)),
      metadata: value.metadata,
    })
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 图持久化结构 (GraphValue)
   */
  toValue(): GraphValue<T> {
    return {
      nodes: Array.from(this.nodes.values()).map((node) => node.toValue()),
      edges: Array.from(this.edges.values()).map((edge) => edge.toValue()),
      metadata: this.metadata,
    }
  }

  // --- Immer Support ---
  // 使 Graph 实例可被 Immer 处理
  [immerable] = true
}
