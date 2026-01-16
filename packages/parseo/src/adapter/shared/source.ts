import type { SourcePoint, SourceSpan } from '../../syntax/diagnostic'

export function createPoint(line: number, column: number, offset: number): SourcePoint {
  return { line, column, offset }
}

export function createSpan(start: SourcePoint, end: SourcePoint): SourceSpan {
  return { start, end }
}

