import type { Edge } from './edge'
import type { Node } from './node'

/**
 * 图定义基类 (GraphSpec)
 *
 * 该抽象类定义了图（Graph）和子图（Subgraph）的通用结构与行为。
 * 它统一了节点与边的存储访问，以及查表（Lookup）和校验（Validate）的标准接口。
 *
 * @abstract
 */
export abstract class GraphSpec {
  /**
   * 图中包含的所有节点。
   * 通常为只读数组，以保证数据的不可变性。
   */
  abstract readonly nodes: readonly Node[]

  /**
   * 图中包含的所有边。
   * 通常为只读数组，以保证数据的不可变性。
   */
  abstract readonly edges: readonly Edge[]

  /**
   * 图的元数据信息。
   * 可用于存储非结构化的辅助信息。
   */
  abstract readonly metadata?: Record<string, unknown>
}
