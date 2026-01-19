/**
 * 引用数据持久化结构
 * 用于序列化和反序列化引用数据
 */
export interface ReferenceValue {
  /** 引用的节点 ID */
  nodeId: string
  /** 引用的端点 ID */
  endpointId: string
}

/**
 * 引用 (Reference)
 *
 * 用于在边中指向一个具体的端点。
 * 它由节点 ID 和端点 ID 组合而成，能够唯一确定图中的一个连接点。
 *
 * 主要特性：
 * - **解耦**：通过 ID 引用而非对象引用，避免了循环依赖和复杂的对象图遍历。
 * - **不可变性**：引用实例创建后不可修改。
 */
export class Reference {
  /** 引用的节点 ID */
  readonly nodeId: string
  /** 引用的端点 ID */
  readonly endpointId: string

  /**
   * 创建一个引用实例。
   *
   * @param options - 初始化选项
   * @param options.nodeId - 节点 ID
   * @param options.endpointId - 端点 ID
   */
  constructor(options: ReferenceValue) {
    this.nodeId = options.nodeId
    this.endpointId = options.endpointId
  }

  /**
   * 从持久化结构创建引用对象。
   *
   * @param value - 引用持久化结构 (ReferenceValue)
   * @returns 引用实例
   */
  static fromValue(value: ReferenceValue): Reference {
    return new Reference(value)
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 引用持久化结构 (ReferenceValue)
   */
  toValue(): ReferenceValue {
    return { nodeId: this.nodeId, endpointId: this.endpointId }
  }
}
