/**
 * 诊断级别
 */
export type Level = 'error' | 'warning'

/**
 * 诊断目标
 */
export type Target =
  | { type: 'graph' }
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | { type: 'endpoint'; id: string }

/**
 * 诊断信息
 */
export interface Diagnostic {
  level: Level
  code: string
  message: string
  target: Target
}
