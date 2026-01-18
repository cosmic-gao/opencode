import type { Edge, Endpoint, Input, Node, Output } from '../model'

/**
 * 查表视图接口 (LookupView)
 *
 * 定义了图查询的统一接口，支持 O(1) 复杂度的快速访问。
 * `Lookup`（不可变）和 `IncrementalLookup`（可变）均实现了此接口。
 *
 * 设计意图：
 * - 统一接口：使得算法（如校验、遍历）可以透明地工作在全量图或增量工作区上。
 * - 性能优先：所有方法设计为 O(1) 查找或 O(1) 返回预计算列表。
 */
export interface LookupView {
  // --- 存在性检查 ---

  /** 检查指定 ID 的节点是否存在 */
  hasNode: (id: string) => boolean
  /** 检查指定 ID 的边是否存在 */
  hasEdge: (id: string) => boolean
  /** 检查指定 ID 的端点是否存在 */
  hasEndpoint: (id: string) => boolean

  // --- 实体获取 ---

  /** 获取指定 ID 的节点，如果不存在返回 undefined */
  getNode: (id: string) => Node | undefined
  /** 获取指定 ID 的边，如果不存在返回 undefined */
  getEdge: (id: string) => Edge | undefined
  /** 获取指定 ID 的端点，如果不存在返回 undefined */
  getEndpoint: (id: string) => Endpoint | undefined
  /** 获取指定 ID 的输入端点，如果不存在返回 undefined */
  getInput: (id: string) => Input | undefined
  /** 获取指定 ID 的输出端点，如果不存在返回 undefined */
  getOutput: (id: string) => Output | undefined

  // --- 关系查询 ---

  /**
   * 根据端点 ID 获取所属的节点 ID。
   * @param endpointId - 端点 ID
   * @returns 节点 ID
   */
  owner: (endpointId: string) => string | undefined

  /**
   * 获取节点的所有端点（输入和输出）。
   * @param nodeId - 节点 ID
   * @returns 端点列表
   */
  endpoints: (nodeId: string) => readonly Endpoint[]

  // --- 边 ID 查询（返回 ID 列表）---

  /** 获取连接到指定输入端点的所有边的 ID */
  inputIds: (inputId: string) => readonly string[]
  /** 获取从指定输出端点发出的所有边的 ID */
  outputIds: (outputId: string) => readonly string[]

  // --- 计数查询（通常比获取列表更快）---

  /** 获取连接到指定输入端点的边数量 */
  inputCount: (inputId: string) => number
  /** 获取从指定输出端点发出的边数量 */
  outputCount: (outputId: string) => number

  // --- 边实体查询（返回 Edge 对象列表）---

  /** 获取连接到指定输入端点的所有边 */
  inputEdges: (inputId: string) => readonly Edge[]
  /** 获取从指定输出端点发出的所有边 */
  outputEdges: (outputId: string) => readonly Edge[]

  /**
   * 获取连接到指定节点的所有入边（连接到该节点任意输入端点的边）。
   * @param nodeId - 节点 ID
   * @returns 边列表
   */
  incoming: (nodeId: string) => readonly Edge[]

  /**
   * 获取从指定节点发出的所有出边（从该节点任意输出端点发出的边）。
   * @param nodeId - 节点 ID
   * @returns 边列表
   */
  outgoing: (nodeId: string) => readonly Edge[]
}
