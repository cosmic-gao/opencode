import type { Diagnostic } from '../../syntax/diagnostic'
import type { SyntaxNode } from '../../syntax/node'
import type { CssToken, CssTokenType } from './lexer'
import { CssLexer } from './lexer'

export class CssParser {
  private tokens: CssToken[] = []
  private index = 0
  private diagnostics: Diagnostic[] = []

  parse(text: string): { nodes: SyntaxNode[]; diagnostics: Diagnostic[] } {
    const lexer = new CssLexer(text)
    const result = lexer.tokenize()
    this.tokens = result.tokens.filter((t) => t.type !== 'comment')
    this.diagnostics = result.diagnostics
    this.index = 0

    const nodes: SyntaxNode[] = []
    
    while (!this.isEnd()) {
      this.skipWhitespace()
      if (this.isEnd()) break

      const node = this.consumeRule()
      if (node) {
        nodes.push(node)
        continue
      }
      this.advance()
    }

    return { nodes, diagnostics: this.diagnostics }
  }

  private peek(offset = 0): CssToken {
    return this.tokens[this.index + offset] || { type: 'eof', text: '', span: { start: { line:0,column:0,offset:0 }, end: { line:0,column:0,offset:0 } } }
  }

  private advance(): CssToken {
    const token = this.tokens[this.index]
    this.index++
    return token!
  }
  
  private isEnd(): boolean {
    return this.index >= this.tokens.length || this.tokens[this.index]?.type === 'eof'
  }

  private match(type: CssTokenType): boolean {
    return this.peek().type === type
  }

  private consume(type: CssTokenType): CssToken | undefined {
    if (this.match(type)) {
      return this.advance()
    }
    return undefined
  }

  private consumeRule(): SyntaxNode | undefined {
    if (this.peek().type === 'atKeyword') return this.consumeAtRule()
    return this.consumeQualifiedRule()
  }

  private consumeAtRule(): SyntaxNode | undefined {
    const at = this.consume('atKeyword')
    if (!at || at.type !== 'atKeyword') return undefined

    const start = at.span.start
    const name = at.value
    const preludeTokens: CssToken[] = []
    while (!this.isEnd()) {
      const t = this.peek()
      if (t.type === 'semicolon' || t.type === 'braceOpen') break
      preludeTokens.push(this.advance())
    }
    const prelude = serializeTokens(preludeTokens).trim()

    if (this.consume('semicolon')) {
      const end = this.peek(-1).span.end
      return {
        type: 'AtRule',
        attrs: { name, prelude },
        span: { start: start.offset, end: end.offset, ctxt: 0 },
        loc: { start, end },
      }
    }

    if (!this.consume('braceOpen')) return undefined
    const children = this.consumeDeclarationList()
    const close = this.consume('braceClose')
    const end = close?.span.end ?? this.peek(-1).span.end

    return {
      type: 'AtRule',
      attrs: { name, prelude },
      children,
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private consumeQualifiedRule(): SyntaxNode | undefined {
    const start = this.peek().span.start
    const preludeTokens: CssToken[] = []
    while (!this.isEnd() && this.peek().type !== 'braceOpen' && this.peek().type !== 'eof') {
      const t = this.peek()
      if (t.type === 'semicolon') return undefined
      preludeTokens.push(this.advance())
    }
    const selector = serializeTokens(preludeTokens).trim()
    if (!selector || !this.consume('braceOpen')) return undefined

    const children = this.consumeDeclarationList()
    const close = this.consume('braceClose')
    const end = close?.span.end ?? this.peek(-1).span.end

    return {
      type: 'RuleSet',
      attrs: { selector },
      children,
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private consumeDeclarationList(): SyntaxNode[] {
    const children: SyntaxNode[] = []
    while (!this.isEnd() && !this.match('braceClose')) {
      this.skipWhitespace()
      if (this.match('semicolon')) {
        this.advance()
        continue
      }

      const decl = this.consumeDeclaration()
      if (decl) {
        children.push(decl)
        continue
      }

      this.recoverBadDeclaration()
    }
    return children
  }

  private consumeDeclaration(): SyntaxNode | undefined {
    const start = this.peek().span.start
    const propertyToken = this.consume('ident')
    if (!propertyToken || propertyToken.type !== 'ident') return undefined

    const property = propertyToken.value
    this.skipWhitespace()
    if (!this.consume('colon')) return undefined

    const valueTokens: CssToken[] = []
    while (!this.isEnd() && !this.match('semicolon') && !this.match('braceClose')) {
      valueTokens.push(this.advance())
    }
    const value = serializeTokens(valueTokens).trim()
    this.consume('semicolon')
    const end = this.peek(-1).span.end

    return {
      type: 'Declaration',
      attrs: { property, value },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private skipWhitespace(): void {
    while (this.peek().type === 'whitespace') this.advance()
  }

  private recoverBadDeclaration(): void {
    while (!this.isEnd() && !this.match('semicolon') && !this.match('braceClose')) {
      this.advance()
    }
    if (this.match('semicolon')) this.advance()
  }
}

function serializeTokens(tokens: CssToken[]): string {
  return tokens.map((t) => t.text).join('')
}
