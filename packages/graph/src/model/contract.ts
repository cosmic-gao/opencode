/**
 * 契约数据持久化结构
 * 用于序列化和反序列化契约数据
 */
export interface ContractValue {
  /** 契约的流类型（例如：'string', 'number', 'json'） */
  flow: string
  /** 契约的模式定义（可选），用于更严格的数据校验 */
  schema?: unknown
}

/**
 * 契约 (Contract)
 *
 * 定义了端点的数据交换协议。
 * 只有当源端点和目标端点的契约兼容时，它们之间才能建立连接（Edge）。
 *
 * 主要特性：
 * - **不可变性**：契约实例创建后不可修改。
 */
export class Contract {
  /** 契约的流类型 */
  readonly flow: string
  /** 契约的模式定义 */
  readonly schema?: unknown

  /**
   * 创建一个契约实例。
   *
   * @param options - 初始化选项
   * @param options.flow - 流类型
   * @param options.schema - 模式定义
   */
  constructor(options: ContractValue) {
    this.flow = options.flow
    this.schema = options.schema
  }

  /**
   * 从持久化结构创建契约对象。
   *
   * @param value - 契约持久化结构 (ContractValue)
   * @returns 契约实例
   */
  static fromValue(value: ContractValue): Contract {
    return new Contract(value)
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 契约持久化结构 (ContractValue)
   */
  toValue(): ContractValue {
    return { flow: this.flow, schema: this.schema }
  }
}
