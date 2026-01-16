import type { Diagnostic, SourceSpan } from '../../syntax/diagnostic'

export function createDiagnostic(level: Diagnostic['level'], code: string, message: string, span?: SourceSpan): Diagnostic {
  return { level, code, message, span }
}

