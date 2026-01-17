import { GraphSpec } from '../model/base'
import { Lookup } from '../lookup'
import type { Node } from '../model/node'
import type { Edge } from '../model/edge'

/**
 * 子图 (Subgraph)
 *
 * 子图是图 (Graph) 的一个子集，通常包含一组核心节点及其相关联的边和邻居节点。
 * 继承自 GraphDefinition，因此具备完整的图操作能力（如查表、校验）。
 *
 * 主要用于：
 * - **局部分析**：分析变更对特定范围内的节点产生的影响。
 * - **隔离视图**：关注图的某一部分，屏蔽无关细节。
 */
export class Subgraph extends GraphSpec {
  /**
   * 子图中包含的节点列表。
   * 可能包含核心节点以及为了保持连通性而引入的边界节点。
   */
  readonly nodes: readonly Node[]

  /**
   * 子图中包含的边列表。
   */
  readonly edges: readonly Edge[]

  /**
   * 核心节点 ID 列表。
   * 标识了构建此子图时的关注点（种子节点）。
   */
  readonly coreNodeIds: readonly string[]

  /**
   * 元数据信息。
   */
  readonly metadata?: Record<string, unknown>

  /**
   * 创建一个子图实例。
   *
   * @param options - 初始化选项
   * @param options.nodes - 节点列表
   * @param options.edges - 边列表
   * @param options.coreNodeIds - 核心节点 ID 列表
   * @param options.metadata - 元数据
   */
  constructor(options: {
    nodes: readonly Node[]
    edges: readonly Edge[]
    coreNodeIds: readonly string[]
    metadata?: Record<string, unknown>
  }) {
    super()
    this.nodes = Object.freeze([...options.nodes])
    this.edges = Object.freeze([...options.edges])
    this.coreNodeIds = Object.freeze([...options.coreNodeIds])
    this.metadata = options.metadata
  }

  /**
   * 创建查表对象。
   *
   * 基于子图的节点和边构建独立的 Lookup 索引。
   *
   * @protected
   * @returns 新的 Lookup 实例
   */
  protected createLookup(): Lookup {
    return new Lookup(this)
  }
}
