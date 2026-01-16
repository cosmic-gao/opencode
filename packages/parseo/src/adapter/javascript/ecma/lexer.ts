import type { Diagnostic } from '../../../syntax/diagnostic'
import type { EcmaToken } from './token'
import { JsLexer } from '../lexer'

export interface EcmaLexResult {
  tokens: EcmaToken[]
  diagnostics: Diagnostic[]
}

export function lexEcma(text: string): EcmaLexResult {
  const lexer = new JsLexer(text)
  const result = lexer.tokenize()
  const tokens: EcmaToken[] = result.tokens.map((t) => {
    if (t.type === 'identifier') return { kind: 'Identifier', text: t.text, span: t.span }
    if (t.type === 'keyword') return { kind: 'Keyword', text: t.text, span: t.span }
    if (t.type === 'string') return { kind: 'String', text: t.text, span: t.span }
    if (t.type === 'number') return { kind: 'Numeric', text: t.text, span: t.span, value: Number(t.text) }
    if (t.type === 'operator' || t.type === 'punctuation') return { kind: 'Punctuator', text: t.text, span: t.span }
    if (t.type === 'jsxTagOpen') return { kind: 'JsxTagOpen', text: t.text, span: t.span }
    if (t.type === 'jsxTagClose') return { kind: 'JsxTagClose', text: t.text, span: t.span }
    if (t.type === 'jsxEndTagOpen') return { kind: 'JsxEndTagOpen', text: t.text, span: t.span }
    if (t.type === 'jsxSelfClosing') return { kind: 'JsxSelfClosing', text: t.text, span: t.span }
    if (t.type === 'eof') return { kind: 'EOF', text: '', span: t.span }
    return { kind: 'Punctuator', text: t.text, span: t.span }
  })
  return { tokens, diagnostics: result.diagnostics }
}

