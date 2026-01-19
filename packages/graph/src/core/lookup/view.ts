import type { Edge, Endpoint, Input, Node, Output } from '../model'

/**
 * 查表视图接口 (LookupView)
 *
 * 定义了图查询的统一接口，支持 O(1) 复杂度的快速访问。
 * `Lookup`（不可变）和 `IncrementalLookup`（可变）均实现了此接口。
 *
 * 设计意图：
 * - **统一接口**：使得算法（如校验、遍历）可以透明地工作在全量图或增量工作区上。
 * - **性能优先**：所有方法设计为 O(1) 查找或 O(1) 返回预计算列表。
 */
export interface LookupView {
  // --- 存在性检查 ---

  /**
   * 检查指定 ID 的节点是否存在。
   * @param id - 节点 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasNode: (id: string) => boolean

  /**
   * 检查指定 ID 的边是否存在。
   * @param id - 边 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasEdge: (id: string) => boolean

  /**
   * 检查指定 ID 的端点是否存在。
   * @param id - 端点 ID
   * @returns 若存在返回 true，否则返回 false
   */
  hasEndpoint: (id: string) => boolean

  // --- 实体获取 ---

  /**
   * 获取指定 ID 的节点。
   * @param id - 节点 ID
   * @returns 节点对象，如果不存在返回 undefined
   */
  getNode: (id: string) => Node | undefined

  /**
   * 获取指定 ID 的边。
   * @param id - 边 ID
   * @returns 边对象，如果不存在返回 undefined
   */
  getEdge: (id: string) => Edge | undefined

  /**
   * 获取指定 ID 的端点。
   * @param id - 端点 ID
   * @returns 端点对象，如果不存在返回 undefined
   */
  getEndpoint: (id: string) => Endpoint | undefined

  /**
   * 获取指定 ID 的输入端点。
   * @param id - 端点 ID
   * @returns 输入端点对象，如果不存在返回 undefined
   */
  getInput: (id: string) => Input | undefined

  /**
   * 获取指定 ID 的输出端点。
   * @param id - 端点 ID
   * @returns 输出端点对象，如果不存在返回 undefined
   */
  getOutput: (id: string) => Output | undefined

  // --- 关系查询 ---

  /**
   * 根据端点 ID 获取所属的节点 ID。
   * @param endpointId - 端点 ID
   * @returns 节点 ID，如果不存在返回 undefined
   */
  owner: (endpointId: string) => string | undefined

  /**
   * 获取节点的所有端点（输入和输出）。
   * @param nodeId - 节点 ID
   * @returns 端点列表（只读）
   */
  endpoints: (nodeId: string) => readonly Endpoint[]

  // --- 边 ID 查询（返回 ID 列表）---

  /**
   * 获取连接到指定输入端点的所有边的 ID。
   * @param inputId - 输入端点 ID
   * @returns 边 ID 列表（只读）
   */
  inputIds: (inputId: string) => readonly string[]

  /**
   * 获取从指定输出端点发出的所有边的 ID。
   * @param outputId - 输出端点 ID
   * @returns 边 ID 列表（只读）
   */
  outputIds: (outputId: string) => readonly string[]

  // --- 计数查询（通常比获取列表更快）---

  /**
   * 获取连接到指定输入端点的边数量。
   * @param inputId - 输入端点 ID
   * @returns 边数量
   */
  inputCount: (inputId: string) => number

  /**
   * 获取从指定输出端点发出的边数量。
   * @param outputId - 输出端点 ID
   * @returns 边数量
   */
  outputCount: (outputId: string) => number

  // --- 边实体查询（返回 Edge 对象列表）---

  /**
   * 获取连接到指定输入端点的所有边。
   * @param inputId - 输入端点 ID
   * @returns 边列表（只读迭代器）
   */
  inputEdges: (inputId: string) => IterableIterator<Edge>

  /**
   * 获取从指定输出端点发出的所有边。
   * @param outputId - 输出端点 ID
   * @returns 边列表（只读迭代器）
   */
  outputEdges: (outputId: string) => IterableIterator<Edge>

  /**
   * 获取连接到指定节点的所有入边（连接到该节点任意输入端点的边）。
   * @param nodeId - 节点 ID
   * @returns 边列表（只读迭代器）
   */
  incoming: (nodeId: string) => IterableIterator<Edge>

  /**
   * 获取从指定节点发出的所有出边（从该节点任意输出端点发出的边）。
   * @param nodeId - 节点 ID
   * @returns 边列表（只读迭代器）
   */
  outgoing: (nodeId: string) => IterableIterator<Edge>
}
