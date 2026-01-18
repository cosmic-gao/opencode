import { Graph, type Edge, type Endpoint, type Input, type Node, type Output } from '../model'
import { Applier } from './applier'
import type { Patch, UndoPatch } from './patch'
import { Registry } from './registry'

export interface StoreOptions {
  nodes?: readonly Node[]
  edges?: readonly Edge[]
  metadata?: Record<string, unknown>
}

export class Store {
  readonly metadata?: Record<string, unknown>

  private readonly registry: Registry
  private readonly applier: Applier

  /**
   * 创建图状态。
   *
   * @param options - 初始化选项
   */
  constructor(options: StoreOptions) {
    this.metadata = options.metadata
    this.registry = new Registry(options.nodes, options.edges)
    this.applier = new Applier(this.registry)
  }

  /**
   * 从不可变 Graph 创建 Store。
   *
   * @param graph - 图快照
   * @returns 图状态
   */
  static from(graph: Graph): Store {
    return new Store({ nodes: graph.nodes, edges: graph.edges, metadata: graph.metadata })
  }


  /**
   * 获取指定 ID 的节点。
   *
   * @param nodeId - 节点 ID
   * @returns 节点对象，若不存在返回 undefined
   */
  getNode(nodeId: string): Node | undefined {
    return this.registry.getNode(nodeId)
  }

  /**
   * 获取指定 ID 的边。
   *
   * @param edgeId - 边 ID
   * @returns 边对象，若不存在返回 undefined
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
   * @returns 节点列表（只读）
   */
  listNodes(): readonly Node[] {
    return this.registry.listNodes()
  }

  /**
   * 获取所有边列表。
   *
   * @returns 边列表（只读）
   */
  listEdges(): readonly Edge[] {
    return this.registry.listEdges()
  }

  /**
   * 获取指定节点的出边（从该节点输出端点发出的边）。
   *
   * @param nodeId - 节点 ID
   * @returns 边列表（只读）
   */
  outgoing(nodeId: string): readonly Edge[] {
    return this.registry.outgoing(nodeId)
  }

  /**
   * 获取指定节点的入边（指向该节点输入端点的边）。
   *
   * @param nodeId - 节点 ID
   * @returns 边列表（只读）
   */
  incoming(nodeId: string): readonly Edge[] {
    return this.registry.incoming(nodeId)
  }

  /**
   * 获取连接到指定输入端点的边。
   *
   * @param inputId - 输入端点 ID
   * @returns 边列表（只读）
   */
  inputEdges(inputId: string): readonly Edge[] {
    return this.registry.inputEdges(inputId)
  }

  /**
   * 获取从指定输出端点发出的边。
   *
   * @param outputId - 输出端点 ID
   * @returns 边列表（只读）
   */
  outputEdges(outputId: string): readonly Edge[] {
    return this.registry.outputEdges(outputId)
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
    return this.applier.apply(patch)
  }
}

