/**
 * 诊断级别
 * - error: 错误，表示图结构非法或违反核心约束，可能导致无法运行
 * - warning: 警告，表示潜在问题或非最佳实践，但不影响基本功能
 */
export type Level = 'error' | 'warning'

/**
 * 诊断目标
 * 指示诊断信息关联的图元素
 */
export type Target =
  | { type: 'graph' } // 关联到整个图
  | { type: 'node'; id: string } // 关联到特定节点
  | { type: 'edge'; id: string } // 关联到特定边
  | { type: 'endpoint'; id: string } // 关联到特定端点

/**
 * 诊断信息 (Diagnostic)
 *
 * 校验过程产生的反馈信息，描述了发现的问题及其位置。
 * 用于指导用户修复图结构错误。
 */
export interface Diagnostic {
  /** 诊断级别 (error/warning) */
  level: Level
  /** 错误代码，用于机器识别或国际化 (例如: 'node-missing', 'cycle-detected') */
  code: string
  /** 人类可读的错误消息 */
  message: string
  /** 错误关联的目标元素 */
  target: Target
}
