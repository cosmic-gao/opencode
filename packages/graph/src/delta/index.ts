import type { Edge } from '../model/edge'
import type { Node } from '../model/node'

/**
 * 图变更描述 (GraphDelta)
 *
 * 描述了对图进行的一组增量修改操作。
 * 它可以被视为一个原子事务：所有的变更（新增和移除）应当在同一次操作中生效。
 *
 * 应用顺序通常为：先移除，后新增。
 * 1. 根据 removedNodeIds 和 removedEdgeIds 移除元素
 * 2. 根据 addedNodes 和 addedEdges 添加元素
 */
export interface GraphDelta {
  /**
   * 待新增的节点列表。
   * 如果图中已存在同名 ID 的节点，通常行为取决于具体实现（可能是忽略或覆盖）。
   */
  addedNodes?: readonly Node[]

  /**
   * 待新增的边列表。
   * 添加边之前，应确保其引用的节点已存在（或是本次 addedNodes 中的一部分）。
   */
  addedEdges?: readonly Edge[]

  /**
   * 待移除的节点 ID 列表。
   * 移除节点通常会级联移除连接到该节点的边。
   */
  removedNodeIds?: readonly string[]

  /**
   * 待移除的边 ID 列表。
   */
  removedEdgeIds?: readonly string[]
}
