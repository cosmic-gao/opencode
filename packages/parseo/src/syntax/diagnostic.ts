export type DiagnosticLevel = 'error' | 'warning'

export interface SourcePoint {
  line: number
  column: number
  offset: number
}

export interface SourceSpan {
  start: SourcePoint
  end: SourcePoint
}

export interface Diagnostic {
  level: DiagnosticLevel
  code: string
  message: string
  span?: SourceSpan
}

/**
 * 创建诊断信息对象。
 *
 * @param params - 诊断字段
 * @returns 诊断对象
 */
export function createDiagnostic(params: Diagnostic): Diagnostic {
  return params
}
