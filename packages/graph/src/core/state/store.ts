import { Graph, type Edge, type Endpoint, type Input, type Node, type Output } from '../model'
import { Apply } from './apply'
import type { Patch, UndoPatch } from './patch'
import { Registry } from './registry'

/**
 * 状态存储 (Store) 选项
 */
export interface StoreOptions {
  /** 初始节点列表 */
  nodes?: readonly Node[]
  /** 初始边列表 */
  edges?: readonly Edge[]
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 图状态存储 (Store)
 *
 * Store 是图数据的单一事实源 (Single Source of Truth)。
 * 它负责维护图的完整状态，包括节点、边及其相互关系。
 *
 * 主要特性：
 * - **可变性**：不同于 Graph 模型的不可变性，Store 是可变的，支持通过 apply 方法应用补丁。
 * - **查询能力**：提供丰富的查询 API，支持按 ID、关系等维度检索图元素。
 * - **事务支持**：通过 Patch 和 UndoPatch 机制支持状态的回滚和重做。
 */
export class Store {
  /** 存储的元数据 */
  readonly metadata?: Record<string, unknown>

  private readonly registry: Registry
  private readonly applier: Apply

  /**
   * 创建图状态存储。
   *
   * @param options - 初始化选项
   * @param options.nodes - 初始节点列表
   * @param options.edges - 初始边列表
   * @param options.metadata - 元数据
   */
  constructor(options: StoreOptions) {
    this.metadata = options.metadata
    this.registry = new Registry(options.nodes, options.edges)
    this.applier = new Apply(this.registry)
  }

  /**
   * 从不可变 Graph 对象创建 Store。
   *
   * @param graph - 图对象快照
   * @returns 图状态存储实例
   *
   * @example
   * const store = Store.from(graph);
   */
  static from(graph: Graph): Store {
    return new Store({ nodes: graph.nodes, edges: graph.edges, metadata: graph.metadata })
  }


  /**
   * 获取指定 ID 的节点。
   *
   * @param nodeId - 节点 ID
   * @returns 节点对象，若不存在返回 undefined
   *
   * @example
   * const node = store.getNode('node-1');
   * if (node) {
   *   console.log(node.type);
   * }
   */
  getNode(nodeId: string): Node | undefined {
    return this.registry.getNode(nodeId)
  }

  /**
   * 获取指定 ID 的边。
   *
   * @param edgeId - 边 ID
   * @returns 边对象，若不存在返回 undefined
   *
   * @example
   * const edge = store.getEdge('edge-1');
   */
  getEdge(edgeId: string): Edge | undefined {
    return this.registry.getEdge(edgeId)
  }

  /**
   * 检查节点是否存在。
   *
   * @param nodeId - 节点 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasNode(nodeId: string): boolean {
    return this.registry.hasNode(nodeId)
  }

  /**
   * 检查边是否存在。
   *
   * @param edgeId - 边 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasEdge(edgeId: string): boolean {
    return this.registry.hasEdge(edgeId)
  }

  /**
   * 检查端点是否存在。
   *
   * @param endpointId - 端点 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasEndpoint(endpointId: string): boolean {
    return this.registry.hasEndpoint(endpointId)
  }

  /**
   * 获取指定 ID 的端点（输入或输出）。
   *
   * @param endpointId - 端点 ID
   * @returns 端点对象，若不存在返回 undefined
   */
  getEndpoint(endpointId: string): Endpoint | undefined {
    return this.registry.getEndpoint(endpointId)
  }

  /**
   * 获取指定 ID 的输入端点。
   *
   * @param endpointId - 端点 ID
   * @returns 输入端点对象，若不存在或不是输入端点返回 undefined
   */
  getInput(endpointId: string): Input | undefined {
    return this.registry.getInput(endpointId)
  }

  /**
   * 获取指定 ID 的输出端点。
   *
   * @param endpointId - 端点 ID
   * @returns 输出端点对象，若不存在或不是输出端点返回 undefined
   */
  getOutput(endpointId: string): Output | undefined {
    return this.registry.getOutput(endpointId)
  }

  /**
   * 获取端点所属的节点 ID。
   *
   * @param endpointId - 端点 ID
   * @returns 节点 ID，若端点不存在返回 undefined
   */
  owner(endpointId: string): string | undefined {
    return this.registry.owner(endpointId)
  }

  /**
   * 获取指定节点的所有端点。
   *
   * @param nodeId - 节点 ID
   * @returns 端点列表（只读）
   */
  endpoints(nodeId: string): readonly Endpoint[] {
    return this.registry.endpointsOf(nodeId)
  }

  /**
   * 获取所有节点列表。
   *
   * @returns 节点列表（只读迭代器）
   */
  get listNodes(): IterableIterator<Node> {
    return this.registry.listNodes
  }

  /**
   * 获取所有边列表。
   *
   * @returns 边列表（只读迭代器）
   */
  get listEdges(): IterableIterator<Edge> {
    return this.registry.listEdges
  }

  /**
   * 获取指定节点的出边（从该节点输出端点发出的边）。
   *
   * @param nodeId - 节点 ID
   * @returns 边列表（只读迭代器）
   */
  outgoing(nodeId: string): IterableIterator<Edge> {
    return this.registry.outgoing(nodeId)
  }

  /**
   * 获取指定节点的入边（指向该节点输入端点的边）。
   *
   * @param nodeId - 节点 ID
   * @returns 边列表（只读迭代器）
   */
  incoming(nodeId: string): IterableIterator<Edge> {
    return this.registry.incoming(nodeId)
  }

  /**
   * 获取连接到指定输入端点的边。
   *
   * @param inputId - 输入端点 ID
   * @returns 边列表（只读迭代器）
   */
  inputEdges(inputId: string): IterableIterator<Edge> {
    return this.registry.inputEdges(inputId)
  }

  /**
   * 获取从指定输出端点发出的边。
   *
   * @param outputId - 输出端点 ID
   * @returns 边列表（只读迭代器）
   */
  outputEdges(outputId: string): IterableIterator<Edge> {
    return this.registry.outputEdges(outputId)
  }

  /**
   * 将当前状态导出为不可变 Graph 对象。
   *
   * @returns 图对象快照
   *
   * @example
   * const snapshot = store.toGraph();
   * console.log(JSON.stringify(snapshot.toValue()));
   */
  toGraph(): Graph {
    return new Graph({ nodes: [...this.listNodes], edges: [...this.listEdges], metadata: this.metadata })
  }

  /**
   * 应用事实补丁 (Patch)，并返回回滚补丁 (UndoPatch)。
   * 此方法会直接修改 Store 的内部状态。
   *
   * @param patch - 事实补丁，包含要添加、移除或替换的节点和边
   * @returns 回滚补丁，用于撤销本次操作
   * @throws {Error} 当补丁引用不存在的实体、引入重复 ID 或包含冲突操作时抛出错误
   *
   * @example
   * // 添加一个新节点
   * const patch = { nodeAdd: [newNode] };
   * const undo = store.apply(patch);
   *
   * // 撤销操作
   * store.apply(undo);
   */
  apply(patch: Patch): UndoPatch {
    return this.applier.apply(patch)
  }
}
