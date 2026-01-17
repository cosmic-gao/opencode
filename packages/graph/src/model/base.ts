import type { Edge } from './edge'
import type { Endpoint } from './endpoint'
import type { Node } from './node'
import type { Diagnostic } from '../validate/diagnostic'
import type { ValidateOptions } from '../validate/validate'
import type { Lookup } from '../lookup'
import type { Rule } from '../validate/rule'
import { defaultRules } from '../validate/validate'

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

  /**
   * 查表对象的缓存。
   * 用于避免重复构建 Lookup 实例。
   */
  protected lookupCache?: Lookup

  /**
   * 获取指定 ID 的节点。
   *
   * @param id - 节点的唯一标识符
   * @returns 对应的节点对象；如果不存在则返回 undefined
   */
  getNode(id: string): Node | undefined {
    return this.lookup().getNode(id)
  }

  /**
   * 获取指定 ID 的边。
   *
   * @param id - 边的唯一标识符
   * @returns 对应的边对象；如果不存在则返回 undefined
   */
  getEdge(id: string): Edge | undefined {
    return this.lookup().getEdge(id)
  }

  /**
   * 获取指定 ID 的端点 (Input 或 Output)。
   *
   * @param id - 端点的唯一标识符
   * @returns 对应的端点对象；如果不存在则返回 undefined
   */
  getEndpoint(id: string): Endpoint | undefined {
    return this.lookup().getEndpoint(id)
  }

  /**
   * 获取图的查表对象 (Lookup)。
   *
   * Lookup 对象提供了基于 Map 的高性能查询能力（O(1) 复杂度），
   * 适用于频繁查找节点、边以及遍历连接关系的场景。
   *
   * 默认实现采用懒加载模式：首次调用时创建并缓存，后续调用直接返回缓存。
   *
   * @returns 查表对象
   */
  lookup(): Lookup {
    if (!this.lookupCache) {
      this.lookupCache = this.createLookup()
    }
    return this.lookupCache
  }

  /**
   * 校验图数据的结构一致性与业务规则。
   *
   * 该方法会根据传入的选项（或默认规则）对图进行静态分析，
   * 检查诸如引用悬空、环路、类型不匹配等问题。
   *
   * @param options - 校验选项，可包含自定义规则集
   * @returns 诊断信息列表 (Diagnostic[])，包含所有的错误与警告
   */
  validate(options: ValidateOptions = {}): Diagnostic[] {
    const lookup = this.lookup()
    const rules = this.createRules(options)

    const diagnostics: Diagnostic[] = []

    for (const rule of rules) {
      diagnostics.push(...rule.evaluate(this as any, lookup))
    }

    return diagnostics
  }

  /**
   * 创建查表对象。
   * 子类需实现此方法以提供具体的 Lookup 构造逻辑。
   *
   * @protected
   * @returns 新的 Lookup 实例
   */
  protected abstract createLookup(): Lookup

  /**
   * 创建校验规则集。
   *
   * @protected
   * @param options - 校验选项
   * @returns 规则列表
   */
  protected createRules(options: ValidateOptions): Rule[] {
    return options.rules ? [...options.rules] : defaultRules(options)
  }
}
