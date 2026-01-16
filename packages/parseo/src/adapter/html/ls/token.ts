import type { SourceSpan } from '../../../syntax/diagnostic'

export type HtmlLsToken =
  | { type: 'Doctype'; name: string; forceQuirks: boolean; span: SourceSpan }
  | { type: 'StartTag'; tagName: string; attrs: Record<string, string | true>; selfClosing: boolean; span: SourceSpan }
  | { type: 'EndTag'; tagName: string; span: SourceSpan }
  | { type: 'Comment'; data: string; span: SourceSpan }
  | { type: 'Character'; data: string; span: SourceSpan }
  | { type: 'EOF'; span: SourceSpan }

