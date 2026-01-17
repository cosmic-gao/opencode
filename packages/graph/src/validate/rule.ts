import type { GraphStore, Patch } from '../state'
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
   * @param state - 图状态（唯一事实源）
   * @param patch - 可选的事实补丁（用于增量校验场景）
   * @returns 诊断信息列表
   */
  evaluate: (state: GraphStore, patch?: Patch) => Diagnostic[]
}
