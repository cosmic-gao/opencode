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

