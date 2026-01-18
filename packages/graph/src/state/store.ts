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


  getNode(nodeId: string): Node | undefined {
    return this.registry.getNode(nodeId)
  }

  getEdge(edgeId: string): Edge | undefined {
    return this.registry.getEdge(edgeId)
  }

  hasNode(nodeId: string): boolean {
    return this.registry.hasNode(nodeId)
  }

  hasEdge(edgeId: string): boolean {
    return this.registry.hasEdge(edgeId)
  }

  hasEndpoint(endpointId: string): boolean {
    return this.registry.hasEndpoint(endpointId)
  }

  getEndpoint(endpointId: string): Endpoint | undefined {
    return this.registry.getEndpoint(endpointId)
  }

  getInput(endpointId: string): Input | undefined {
    return this.registry.getInput(endpointId)
  }

  getOutput(endpointId: string): Output | undefined {
    return this.registry.getOutput(endpointId)
  }

  owner(endpointId: string): string | undefined {
    return this.registry.owner(endpointId)
  }

  endpoints(nodeId: string): readonly Endpoint[] {
    return this.registry.endpointsOf(nodeId)
  }

  listNodes(): readonly Node[] {
    return this.registry.listNodes()
  }

  listEdges(): readonly Edge[] {
    return this.registry.listEdges()
  }

  outgoing(nodeId: string): readonly Edge[] {
    return this.registry.outgoing(nodeId)
  }

  incoming(nodeId: string): readonly Edge[] {
    return this.registry.incoming(nodeId)
  }

  inputEdges(inputId: string): readonly Edge[] {
    return this.registry.inputEdges(inputId)
  }

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

