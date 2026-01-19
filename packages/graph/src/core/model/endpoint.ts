import { createId } from '../../common'
import { type ContractValue, Contract } from './contract'

/**
 * 端点数据持久化结构
 * 用于序列化和反序列化端点数据
 */
export interface EndpointValue {
  /** 端点的唯一标识符（在节点范围内唯一） */
  id: string
  /** 端点的可读名称 */
  name: string
  /** 端点的契约（定义了数据流类型和约束） */
  contract: ContractValue
  /** 端点的元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 端点初始化选项
 * 用于创建端点实例
 */
export interface EndpointOptions {
  /** 唯一标识符（如果未提供，将自动生成 16 位 ID） */
  id?: string
  /** 可读名称 */
  name: string
  /** 契约（可以是 Contract 对象或其持久化值） */
  contract: Contract | ContractValue
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 端点 (Endpoint)
 *
 * 节点上的连接点，用于数据的输入或输出。
 * 它是 Input 和 Output 的基类。
 *
 * 主要特性：
 * - **契约约束**：每个端点都有一个 Contract，定义了流经该端点的数据类型。
 * - **不可变性**：端点实例创建后不可修改。
 */
export class Endpoint {
  /** 端点的唯一标识符 */
  readonly id: string
  /** 端点的可读名称 */
  readonly name: string
  /** 端点的契约 */
  readonly contract: Contract
  /** 端点的元数据 */
  readonly metadata?: Record<string, unknown>

  /**
   * 创建一个端点实例。
   *
   * @param options - 初始化选项
   * @param options.id - 唯一标识符 (可选)
   * @param options.name - 可读名称
   * @param options.contract - 契约
   * @param options.metadata - 元数据
   */
  constructor(options: EndpointOptions) {
    this.id = options.id ?? createId('ep')
    this.name = options.name
    this.contract = options.contract instanceof Contract
      ? options.contract
      : new Contract(options.contract)
    this.metadata = options.metadata
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 端点持久化结构 (EndpointValue)
   */
  toValue(): EndpointValue {
    return {
      id: this.id,
      name: this.name,
      contract: this.contract.toValue(),
      metadata: this.metadata,
    }
  }
}
