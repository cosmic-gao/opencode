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
    this.tokens = result.tokens.filter(t => t.type !== 'comment') // 暂忽略注释
    this.diagnostics = result.diagnostics
    this.index = 0

    const nodes: SyntaxNode[] = []
    
    while (!this.isEnd()) {
      const node = this.parseRule()
      if (node) nodes.push(node)
      else this.advance()
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

  private parseRule(): SyntaxNode | undefined {
    // Selector
    const start = this.peek().span.start
    let selector = ''
    while (!this.isEnd() && !this.match('braceOpen')) {
      selector += this.advance().text + ' '
    }
    selector = selector.trim()
    
    if (!selector || !this.consume('braceOpen')) return undefined
    
    // Declarations
    const children: SyntaxNode[] = []
    while (!this.isEnd() && !this.match('braceClose')) {
      const decl = this.parseDeclaration()
      if (decl) children.push(decl)
      else if (!this.match('braceClose')) this.advance() // skip invalid
    }
    
    const closeToken = this.consume('braceClose')
    const end = closeToken?.span.end || this.peek(-1).span.end
    
    return {
      type: 'RuleSet',
      attrs: { selector },
      children,
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private parseDeclaration(): SyntaxNode | undefined {
    if (this.match('semicolon')) {
        this.advance()
        return undefined
    }

    const start = this.peek().span.start
    const propertyToken = this.consume('value')
    if (!propertyToken) return undefined
    
    const property = propertyToken.text
    
    if (!this.consume('colon')) return undefined
    
    let value = ''
    while (!this.isEnd() && !this.match('semicolon') && !this.match('braceClose')) {
      value += this.advance().text + ' '
    }
    
    this.consume('semicolon') // 可选
    
    const end = this.peek(-1).span.end
    
    return {
      type: 'Declaration',
      attrs: { property, value: value.trim() },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }
}
