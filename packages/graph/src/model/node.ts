import { generateId } from '../utils/id'
import type { EndpointValue } from './endpoint'
import { Input } from './input'
import { Output } from './output'

/**
 * 节点数据持久化结构
 * 用于序列化和反序列化节点数据
 */
export interface NodeValue {
  /** 节点的唯一标识符 */
  id: string
  /** 节点的类型标识，用于区分不同功能的节点 */
  type: string
  /** 节点的可读名称（可选） */
  name?: string
  /** 节点的输入端点列表 */
  inputs: EndpointValue[]
  /** 节点的输出端点列表 */
  outputs: EndpointValue[]
  /** 节点的元数据，用于存储额外的业务信息 */
  metadata?: Record<string, unknown>
}

/**
 * 节点初始化选项
 */
export interface NodeOptions {
  /** 唯一标识符（如果未提供，将自动生成） */
  id?: string
  /** 类型标识 */
  type: string
  /** 可读名称 */
  name?: string
  /** 输入端点列表 */
  inputs?: readonly Input[]
  /** 输出端点列表 */
  outputs?: readonly Output[]
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 节点 (Node)
 *
 * 图中的基本计算单元或数据处理单元。
 * 节点包含输入端点 (Inputs) 和输出端点 (Outputs)，通过这些端点与其他节点连接。
 *
 * 主要特性：
 * - **不可变性 (Immutable)**：节点实例一旦创建，其属性不可被修改。
 * - **可序列化**：支持与 JSON 结构 (NodeValue) 的相互转换。
 */
export class Node {
  /** 节点的唯一标识符 */
  readonly id: string
  /** 节点的类型标识 */
  readonly type: string
  /** 节点的可读名称 */
  readonly name?: string
  /** 节点的输入端点列表（只读） */
  readonly inputs: readonly Input[]
  /** 节点的输出端点列表（只读） */
  readonly outputs: readonly Output[]
  /** 节点的元数据 */
  readonly metadata?: Record<string, unknown>

  /**
   * 创建一个节点实例。
   *
   * @param options - 初始化选项
   * @param options.id - 唯一标识符 (可选)
   * @param options.type - 类型标识
   * @param options.name - 可读名称
   * @param options.inputs - 输入端点列表
   * @param options.outputs - 输出端点列表
   * @param options.metadata - 元数据
   */
  constructor(options: NodeOptions) {
    this.id = options.id ?? generateId('node')
    this.type = options.type
    this.name = options.name
    // 使用 Object.freeze 确保数组不可变
    this.inputs = Object.freeze([...(options.inputs ?? [])])
    this.outputs = Object.freeze([...(options.outputs ?? [])])
    this.metadata = options.metadata
  }

  /**
   * 从持久化结构创建节点对象。
   *
   * @param value - 节点持久化结构 (NodeValue)
   * @returns 节点实例
   *
   * @example
   * const node = Node.fromValue({
   *   id: 'node-1',
   *   type: 'process',
   *   inputs: [],
   *   outputs: []
   * });
   */
  static fromValue(value: NodeValue): Node {
    const inputs = value.inputs.map((endpoint) => Input.fromValue(endpoint))
    const outputs = value.outputs.map((endpoint) => Output.fromValue(endpoint))

    return new Node({
      id: value.id,
      type: value.type,
      name: value.name,
      inputs,
      outputs,
      metadata: value.metadata,
    })
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 节点持久化结构 (NodeValue)
   */
  toValue(): NodeValue {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      inputs: this.inputs.map((endpoint) => endpoint.toValue()),
      outputs: this.outputs.map((endpoint) => endpoint.toValue()),
      metadata: this.metadata,
    }
  }
}
