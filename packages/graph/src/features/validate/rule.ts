import type { Patch } from '../../core/state/patch'
import type { Diagnostic } from './diagnostic'
import type { GraphState } from './state'

/**
 * 校验规则 (Rule)
 *
 * 定义了一个独立的校验逻辑。
 * 规则接收图定义和查表对象，返回一组诊断信息。
 *
 * 设计意图：
 * - **独立性**：每个规则只关注一个特定的约束条件。
 * - **可插拔**：可以根据需要组合不同的规则。
 * - **增量支持**：evaluate 方法接收可选的 Patch，允许规则优化执行效率，只检查变更部分。
 */
export interface Rule {
  /** 规则名称，用于标识和配置 */
  name: string
  /**
   * 执行校验逻辑。
   *
   * @param state - 图状态（唯一事实源）
   * @param patch - 可选的事实补丁（用于增量校验场景）。如果未提供，则执行全量校验。
   * @returns 诊断信息列表
   */
  evaluate: (state: GraphState, patch?: Patch) => Diagnostic[]
}
