import type { Diagnostic } from '../../../syntax/diagnostic'
import type { SyntaxNode } from '../../../syntax/node'
import { ArrayTokenStream } from '../../shared/token-stream'
import type { EcmaToken } from './token'
import { lexEcma } from './lexer'

export interface EcmaParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

export class EcmaParser {
  parse(text: string): EcmaParseResult {
    const lexed = lexEcma(text)
    const stream = new ArrayTokenStream<EcmaToken>(lexed.tokens)
    const nodes: SyntaxNode[] = []

    while (stream.peek()?.kind !== 'EOF') {
      const token = stream.peek()
      if (!token) break
      stream.advance()
      nodes.push({
        type: 'Token',
        attrs: { kind: token.kind, text: token.text },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      })
    }

    return { nodes, diagnostics: lexed.diagnostics }
  }
}

