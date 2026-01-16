import type { Diagnostic, SourcePoint, SourceSpan } from '../../syntax/diagnostic'
import type { SyntaxNode } from '../../syntax/node'

export type CssTokenType =
  | 'selector'
  | 'braceOpen' // {
  | 'braceClose' // }
  | 'colon' // :
  | 'semicolon' // ;
  | 'property'
  | 'value'
  | 'comment'
  | 'whitespace'
  | 'eof'

export interface CssToken {
  type: CssTokenType
  text: string
  span: SourceSpan
}

function createPoint(line: number, column: number, offset: number): SourcePoint {
  return { line, column, offset }
}

function createSpan(start: SourcePoint, end: SourcePoint): SourceSpan {
  return { start, end }
}

class CssTokenizer {
  private readonly text: string
  private readonly tokens: CssToken[] = []
  private readonly diagnostics: Diagnostic[] = []
  
  private index = 0
  private line = 1
  private column = 1

  constructor(text: string) {
    this.text = text
  }

  tokenize(): { tokens: CssToken[]; diagnostics: Diagnostic[] } {
    while (this.index < this.text.length) {
      if (this.readWhitespace()) continue
      if (this.readComment()) continue
      if (this.readPunctuation()) continue
      
      // 简单处理：非标点非空白的连续字符视为标识符（可能用于选择器、属性名、属性值）
      // 这里不区分那么细，由 parser 决定
      this.readIdentifier()
    }
    
    this.addToken('eof', '', this.point(), this.point())
    return { tokens: this.tokens, diagnostics: this.diagnostics }
  }

  private point(): SourcePoint {
    return createPoint(this.line, this.column, this.index)
  }

  private advanceChar(): string {
    const char = this.text[this.index]
    this.index++
    if (char === '\n') {
      this.line++
      this.column = 1
    } else {
      this.column++
    }
    return char!
  }
  
  private peek(offset = 0): string {
    return this.text[this.index + offset] || ''
  }

  private addToken(type: CssTokenType, text: string, start: SourcePoint, end: SourcePoint) {
    this.tokens.push({ type, text, span: createSpan(start, end) })
  }

  private readWhitespace(): boolean {
    if (!/\s/.test(this.peek())) return false
    while (/\s/.test(this.peek())) {
      this.advanceChar()
    }
    return true
  }

  private readComment(): boolean {
    if (this.peek() === '/' && this.peek(1) === '*') {
      const start = this.point()
      let text = ''
      this.advanceChar(); this.advanceChar(); text += '/*'
      
      while (this.index < this.text.length && !(this.peek() === '*' && this.peek(1) === '/')) {
        text += this.advanceChar()
      }
      
      if (this.index < this.text.length) {
        this.advanceChar(); this.advanceChar(); text += '*/'
      }
      
      const end = this.point()
      this.addToken('comment', text, start, end)
      return true
    }
    return false
  }

  private readPunctuation(): boolean {
    const char = this.peek()
    const start = this.point()
    
    if (char === '{') {
      this.advanceChar()
      this.addToken('braceOpen', '{', start, this.point())
      return true
    }
    if (char === '}') {
      this.advanceChar()
      this.addToken('braceClose', '}', start, this.point())
      return true
    }
    if (char === ':') {
      this.advanceChar()
      this.addToken('colon', ':', start, this.point())
      return true
    }
    if (char === ';') {
      this.advanceChar()
      this.addToken('semicolon', ';', start, this.point())
      return true
    }
    return false
  }

  private readIdentifier(): void {
    const start = this.point()
    let text = ''
    // 读取直到遇到标点或空白
    while (this.index < this.text.length && !/[\s{}:;]/.test(this.peek()) && !(this.peek() === '/' && this.peek(1) === '*')) {
      text += this.advanceChar()
    }
    // 如果是空的（例如只剩 EOF），跳过
    if (text) {
      // 暂时统称为 value，parser 会根据上下文重命名
      this.addToken('value', text, start, this.point())
    } else if (this.index < this.text.length) {
        // 避免死循环，吞掉未知字符
        this.advanceChar()
    }
  }
}

export class CssParser {
  private tokens: CssToken[] = []
  private index = 0
  private diagnostics: Diagnostic[] = []

  parse(text: string): { nodes: SyntaxNode[]; diagnostics: Diagnostic[] } {
    const tokenizer = new CssTokenizer(text)
    const result = tokenizer.tokenize()
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
      kind: 'RuleSet',
      attrs: { selector },
      children,
      span: { start, end }
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
      kind: 'Declaration',
      attrs: { property, value: value.trim() },
      span: { start, end }
    }
  }
}
