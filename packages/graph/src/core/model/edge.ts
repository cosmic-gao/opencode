import { useId } from '../../common'
import { type ReferenceValue, Reference } from './reference'

/**
 * 边数据持久化结构
 * 用于序列化和反序列化边数据
 */
export interface EdgeValue {
  /** 边的唯一标识符 */
  id: string
  /** 边的起始引用（源头） */
  source: ReferenceValue
  /** 边的目标引用（终点） */
  target: ReferenceValue
  /** 边的元数据，用于存储额外的业务信息 */
  metadata?: Record<string, unknown>
}

/**
 * 边初始化选项
 */
export interface EdgeOptions {
  /** 唯一标识符（如果未提供，将自动生成） */
  id?: string
  /** 起始引用（可以是 Reference 对象或其持久化值） */
  source: Reference | ReferenceValue
  /** 目标引用（可以是 Reference 对象或其持久化值） */
  target: Reference | ReferenceValue
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 边 (Edge)
 *
 * 图中的连接线，表示节点之间的数据流向或逻辑关系。
 * 边连接两个端点：源端点 (source) 和目标端点 (target)。
 *
 * 主要特性：
 * - **不可变性 (Immutable)**：边实例一旦创建，其属性不可被修改。
 * - **引用连接**：通过 Reference 对象间接引用节点和端点，而不是直接持有对象引用，这有利于序列化和解耦。
 */
export class Edge {
  /** 边的唯一标识符 */
  readonly id: string
  /** 边的起始引用 */
  readonly source: Reference
  /** 边的目标引用 */
  readonly target: Reference
  /** 边的元数据 */
  readonly metadata?: Record<string, unknown>

  /**
   * 创建一个边实例。
   *
   * @param options - 初始化选项
   * @param options.id - 唯一标识符 (可选)
   * @param options.source - 起始引用
   * @param options.target - 目标引用
   * @param options.metadata - 元数据
   */
  constructor(options: EdgeOptions) {
    this.id = options.id ?? useId('edge')
    this.source = options.source instanceof Reference ? options.source : new Reference(options.source)
    this.target = options.target instanceof Reference ? options.target : new Reference(options.target)
    this.metadata = options.metadata
  }

  /**
   * 从持久化结构创建边对象。
   *
   * @param value - 边持久化结构 (EdgeValue)
   * @returns 边实例
   *
   * @example
   * const edge = Edge.fromValue({
   *   id: 'edge-1',
   *   source: { nodeId: 'n1', endpointId: 'out' },
   *   target: { nodeId: 'n2', endpointId: 'in' }
   * });
   */
  static fromValue(value: EdgeValue): Edge {
    return new Edge({
      id: value.id,
      source: value.source,
      target: value.target,
      metadata: value.metadata,
    })
  }

  /**
   * 转换为可序列化的持久化结构。
   *
   * @returns 边持久化结构 (EdgeValue)
   */
  toValue(): EdgeValue {
    return {
      id: this.id,
      source: this.source.toValue(),
      target: this.target.toValue(),
      metadata: this.metadata,
    }
  }
}
