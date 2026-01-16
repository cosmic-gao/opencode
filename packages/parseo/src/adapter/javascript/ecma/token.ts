import type { SourceSpan } from '../../../syntax/diagnostic'

export type EcmaTokenKind =
  | 'Identifier'
  | 'Keyword'
  | 'String'
  | 'Numeric'
  | 'Punctuator'
  | 'EOF'
  | 'JsxTagOpen'
  | 'JsxTagClose'
  | 'JsxEndTagOpen'
  | 'JsxSelfClosing'

export interface EcmaToken {
  kind: EcmaTokenKind
  text: string
  span: SourceSpan
  value?: unknown
}

