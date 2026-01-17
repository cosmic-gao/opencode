import type { GraphDefinition } from '../model/graph-definition'
import type { LookupView } from '../lookup/view'
import type { Diagnostic } from './diagnostic'

/**
 * 校验规则 (Rule)
 *
 * 定义了一个独立的校验逻辑。
 * 规则接收图定义和查表对象，返回一组诊断信息。
 */
export interface Rule {
  /** 规则名称，用于标识和配置 */
  name: string
  /**
   * 执行校验逻辑。
   *
   * @param graph - 图定义对象（包含节点和边）
   * @param lookup - 查表对象（提供高效查询能力）
   * @returns 诊断信息列表
   */
  evaluate: (graph: GraphDefinition, lookup: LookupView) => Diagnostic[]
}
