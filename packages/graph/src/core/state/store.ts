import { Graph, type GraphOptions, type Edge, type Endpoint, type Input, type Node, type Output } from '../model'
import { Index, type Scope } from '../lookup'
import type { Patch, UndoPatch } from './patch'

/**
 * 状态存储 (Store) 选项
 */
export interface StoreOptions<T = Record<string, unknown>> extends GraphOptions<T> {}

/**
 * 图状态存储 (Store)
 *
 * Store 是图数据的单一事实源 (Single Source of Truth)。
 * 它负责维护图的完整状态，包括节点、边及其相互关系。
 *
 * 架构说明：
 * - **Storage (Graph)**: 持有一个不可变的 Graph 实例，利用 Immer 实现结构共享和 O(1) 快照。
 * - **Index (Index)**: 持有一个可变的 Index 实例，维护高性能的反向查找索引。
 *
 * 主要特性：
 * - **可变性**：Store 是可变的，通过 apply 方法应用补丁。
 * - **查询能力**：提供丰富的查询 API，支持按 ID、关系等维度检索图元素。
 * - **事务支持**：通过 Patch 和 UndoPatch 机制支持状态的回滚和重做。
 */
export class Store<T = Record<string, unknown>> implements Scope {
  /** 当前图状态（不可变） */
  private current: Graph<T>
  /** 反向查找索引（可变） */
  private index: Index

  /**
   * 创建图状态存储。
   *
   * @param options - 初始化选项
   */
  constructor(options: StoreOptions<T> | Graph<T>) {
    if (options instanceof Graph) {
      this.current = options
    } else {
      this.current = new Graph(options)
    }
    this.index = new Index(this.current as unknown as Graph)
  }

  /**
   * 从不可变 Graph 对象创建 Store。
   *
   * @param graph - 图对象快照
   * @returns 图状态存储实例
   */
  static from<T = Record<string, unknown>>(graph: Graph<T>): Store<T> {
    return new Store(graph)
  }

  /**
   * 获取当前不可变 Graph 快照。
   * 此操作为 O(1) 复杂度。
   *
   * @returns 图对象快照
   */
  toGraph(): Graph<T> {
    return this.current
  }

  /**
   * 应用事实补丁 (Patch)，并返回回滚补丁 (UndoPatch)。
   * 此方法会同时更新 Graph 数据和 Index 索引。
   *
   * @param patch - 事实补丁
   * @returns 回滚补丁
   */
  apply(patch: Patch): UndoPatch {
    // 1. 生成回滚补丁 (需要在应用变更前计算)
    const undo = this.createUndoPatch(patch)

    // 2. 更新 Graph (Immer 产生新实例)
    this.current = this.current.patch(patch)

    // 3. 更新 Index (增量更新)
    this.index.patch(patch)

    return undo
  }

  private createUndoPatch(patch: Patch): UndoPatch {
    const undo: UndoPatch = {}

    // Add -> Remove
    if (patch.nodeAdd) {
      undo.nodeRemove = patch.nodeAdd.map((n) => n.id)
    }
    if (patch.edgeAdd) {
      undo.edgeRemove = patch.edgeAdd.map((e) => e.id)
    }

    // Remove -> Add (Restore)
    if (patch.nodeRemove) {
      const restoredNodes: Node[] = []
      for (const id of patch.nodeRemove) {
        const node = this.current.nodes.get(id)
        if (node) restoredNodes.push(node)
      }
      if (restoredNodes.length > 0) undo.nodeAdd = restoredNodes
    }
    if (patch.edgeRemove) {
      const restoredEdges: Edge[] = []
      for (const id of patch.edgeRemove) {
        const edge = this.current.edges.get(id)
        if (edge) restoredEdges.push(edge)
      }
      if (restoredEdges.length > 0) undo.edgeAdd = restoredEdges
    }

    // Replace -> Replace (Restore old value)
    if (patch.nodeReplace) {
      const oldNodes: Node[] = []
      for (const newNode of patch.nodeReplace) {
        const oldNode = this.current.nodes.get(newNode.id)
        if (oldNode) oldNodes.push(oldNode)
      }
      if (oldNodes.length > 0) undo.nodeReplace = oldNodes
    }
    if (patch.edgeReplace) {
      const oldEdges: Edge[] = []
      for (const newEdge of patch.edgeReplace) {
        const oldEdge = this.current.edges.get(newEdge.id)
        if (oldEdge) oldEdges.push(oldEdge)
      }
      if (oldEdges.length > 0) undo.edgeReplace = oldEdges
    }

    return undo
  }

  // --- 查询代理 (Delegation) ---

  get metadata(): T | undefined {
    return this.current.metadata
  }

  get listNodes(): IterableIterator<Node> {
    return this.current.nodes.values()
  }

  get listEdges(): IterableIterator<Edge> {
    return this.current.edges.values()
  }

  getNode(id: string): Node | undefined {
    return this.current.nodes.get(id)
  }

  getEdge(id: string): Edge | undefined {
    return this.current.edges.get(id)
  }

  hasNode(id: string): boolean {
    return this.current.nodes.has(id)
  }

  hasEdge(id: string): boolean {
    return this.current.edges.has(id)
  }

  // --- Index 代理 ---

  hasEndpoint(id: string): boolean {
    return this.index.hasEndpoint(id)
  }

  getEndpoint(id: string): Endpoint | undefined {
    return this.index.getEndpoint(id)
  }

  getInput(id: string): Input | undefined {
    return this.index.getInput(id)
  }

  getOutput(id: string): Output | undefined {
    return this.index.getOutput(id)
  }

  owner(endpointId: string): string | undefined {
    return this.index.owner(endpointId)
  }

  endpoints(nodeId: string): readonly Endpoint[] {
    return this.index.endpoints(nodeId)
  }

  inputIds(inputId: string): readonly string[] {
    return this.index.inputIds(inputId)
  }

  outputIds(outputId: string): readonly string[] {
    return this.index.outputIds(outputId)
  }

  inputCount(inputId: string): number {
    return this.index.inputCount(inputId)
  }

  outputCount(outputId: string): number {
    return this.index.outputCount(outputId)
  }

  outgoing(nodeId: string): IterableIterator<Edge> {
    return this.index.outgoing(nodeId)
  }

  incoming(nodeId: string): IterableIterator<Edge> {
    return this.index.incoming(nodeId)
  }

  inputEdges(inputId: string): IterableIterator<Edge> {
    return this.index.inputEdges(inputId)
  }

  outputEdges(outputId: string): IterableIterator<Edge> {
    return this.index.outputEdges(outputId)
  }
}
