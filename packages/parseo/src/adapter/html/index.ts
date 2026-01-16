import type { Diagnostic, SourcePoint, SourceSpan } from '../../syntax/diagnostic'
import type { MetaValue, SyntaxNode } from '../../syntax/node'
import type { Adapter, AdaptResult } from '../../adapter'
import { createPoint, createSpan } from '../shared/source'

export type HtmlTokenType =
  | 'startTagOpen' // <
  | 'startTagClose' // >
  | 'endTagOpen' // </
  | 'selfClosingTagClose' // />
  | 'tagName' // div
  | 'attrName' // class
  | 'equals' // =
  | 'attrValue' // "foo"
  | 'text' // hello
  | 'comment' // <!-- ... -->
  | 'doctype' // <!DOCTYPE ...>
  | 'eof'

export interface HtmlToken {
  type: HtmlTokenType
  text: string
  span: SourceSpan
}

export interface HtmlParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

/**
 * 简单的 HTML Tokenizer
 */
class HtmlTokenizer {
  private readonly text: string
  private readonly tokens: HtmlToken[] = []
  private readonly diagnostics: Diagnostic[] = []
  
  private index = 0
  private line = 1
  private column = 1

  constructor(text: string) {
    this.text = text
  }

  tokenize(): { tokens: HtmlToken[]; diagnostics: Diagnostic[] } {
    while (this.index < this.text.length) {
      if (this.readComment()) continue
      if (this.readDoctype()) continue
      if (this.readTagOpen()) continue
      if (this.readEndTagOpen()) continue
      
      this.readText()
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

  private addToken(type: HtmlTokenType, text: string, start: SourcePoint, end: SourcePoint) {
    this.tokens.push({ type, text, span: createSpan(start, end) })
  }

  private readComment(): boolean {
    if (this.peek() === '<' && this.peek(1) === '!' && this.peek(2) === '-' && this.peek(3) === '-') {
      const start = this.point()
      let text = ''
      this.advanceChar(); this.advanceChar(); this.advanceChar(); this.advanceChar();
      text += '<!--'
      
      while (this.index < this.text.length && !(this.peek() === '-' && this.peek(1) === '-' && this.peek(2) === '>')) {
        text += this.advanceChar()
      }
      
      if (this.index < this.text.length) {
        this.advanceChar(); this.advanceChar(); this.advanceChar();
        text += '-->'
      }
      
      const end = this.point()
      this.addToken('comment', text, start, end)
      return true
    }
    return false
  }

  private readDoctype(): boolean {
    if (this.peek() === '<' && this.peek(1) === '!' && this.peek(2).toUpperCase() === 'D') {
      // 简单匹配 <!DOCTYPE ... >
      const start = this.point()
      let text = ''
      // consume <
      text += this.advanceChar()
      
      while (this.index < this.text.length && this.peek() !== '>') {
        text += this.advanceChar()
      }
      
      if (this.peek() === '>') {
        text += this.advanceChar()
      }
      
      const end = this.point()
      this.addToken('doctype', text, start, end)
      return true
    }
    return false
  }

  private readTagOpen(): boolean {
    if (this.peek() !== '<' || this.peek(1) === '/' || !/[a-zA-Z]/.test(this.peek(1))) return false
    
    // <
    const start = this.point()
    this.advanceChar() 
    const end = this.point()
    this.addToken('startTagOpen', '<', start, end)
    
    // tagName
    this.readTagName()
    
    // attributes
    this.readAttributes()
    
    // > or />
    this.readTagClose()
    
    return true
  }

  private readEndTagOpen(): boolean {
    if (this.peek() !== '<' || this.peek(1) !== '/') return false
    
    // </
    const start = this.point()
    this.advanceChar()
    this.advanceChar()
    const end = this.point()
    this.addToken('endTagOpen', '</', start, end)
    
    // tagName
    this.readTagName()
    
    this.skipWhitespace()
    
    // >
    if (this.peek() === '>') {
      const s = this.point()
      this.advanceChar()
      const e = this.point()
      this.addToken('startTagClose', '>', s, e)
    }
    
    return true
  }

  private readTagName(): void {
    const start = this.point()
    let name = ''
    while (/[a-zA-Z0-9-]/.test(this.peek())) {
      name += this.advanceChar()
    }
    const end = this.point()
    this.addToken('tagName', name, start, end)
  }

  private readAttributes(): void {
    while (true) {
      this.skipWhitespace()
      if (this.peek() === '>' || (this.peek() === '/' && this.peek(1) === '>') || this.index >= this.text.length) break
      
      // attrName
      const start = this.point()
      let name = ''
      // 允许 @ : . # 等字符用于 Vue 属性或其他框架属性
      while (/[^=\s/>]/.test(this.peek()) && this.index < this.text.length) {
        name += this.advanceChar()
      }
      const end = this.point()
      if (name) {
        this.addToken('attrName', name, start, end)
      }

      this.skipWhitespace()
      
      // =
      if (this.peek() === '=') {
        const s = this.point()
        this.advanceChar()
        const e = this.point()
        this.addToken('equals', '=', s, e)
        
        this.skipWhitespace()
        
        // value
        this.readAttrValue()
      }
    }
  }

  private readAttrValue(): void {
    const quote = this.peek()
    if (quote === '"' || quote === "'") {
      const start = this.point()
      this.advanceChar() // quote
      
      let value = ''
      while (this.peek() !== quote && this.index < this.text.length) {
        value += this.advanceChar()
      }
      
      this.advanceChar() // quote
      const end = this.point()
      this.addToken('attrValue', value, start, end)
    } else {
      // 无引号属性值
      const start = this.point()
      let value = ''
      while (/[^\s/>]/.test(this.peek()) && this.index < this.text.length) {
        value += this.advanceChar()
      }
      const end = this.point()
      this.addToken('attrValue', value, start, end)
    }
  }

  private readTagClose(): void {
    this.skipWhitespace()
    if (this.peek() === '/' && this.peek(1) === '>') {
      const s = this.point()
      this.advanceChar()
      this.advanceChar()
      const e = this.point()
      this.addToken('selfClosingTagClose', '/>', s, e)
    } else if (this.peek() === '>') {
      const s = this.point()
      this.advanceChar()
      const e = this.point()
      this.addToken('startTagClose', '>', s, e)
    }
  }

  private readText(): void {
    const start = this.point()
    let content = ''
    while (this.index < this.text.length && this.peek() !== '<') {
      content += this.advanceChar()
    }
    const end = this.point()
    if (content) {
      this.addToken('text', content, start, end)
    }
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advanceChar()
    }
  }
}

/**
 * 简单的 HTML 解析器
 */
export class HtmlParser {
  private tokens: HtmlToken[] = []
  private index = 0
  private diagnostics: Diagnostic[] = []

  parse(text: string): HtmlParseResult {
    const tokenizer = new HtmlTokenizer(text)
    const result = tokenizer.tokenize()
    this.tokens = result.tokens
    this.diagnostics = result.diagnostics
    this.index = 0

    const nodes: SyntaxNode[] = []
    
    while (!this.isEnd()) {
      const startIndex = this.index
      const node = this.parseNode()
      if (node) {
        nodes.push(node)
      } else if (this.index === startIndex) {
        // 只有在未消费任何 token 时才强制前进，避免死循环
        this.advance() 
      }
    }

    return { nodes, diagnostics: this.diagnostics }
  }

  private parseNode(): SyntaxNode | undefined {
    const token = this.peek()
    
    if (token.type === 'text') {
      this.advance()
      const content = token.text.trim()
      if (!content) return undefined
      return { 
        type: 'Text', 
        attrs: { value: content },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }
    
    if (token.type === 'comment') {
      this.advance()
      return {
        type: 'Comment',
        attrs: { value: token.text },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }

    if (token.type === 'doctype') {
      this.advance()
      return {
        type: 'Doctype',
        attrs: { value: token.text },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }

    if (token.type === 'startTagOpen') {
      return this.parseElement()
    }
    
    // 忽略其他非法 token
    return undefined
  }

  private parseElement(): SyntaxNode | undefined {
    // <
    const startToken = this.consume('startTagOpen')
    if (!startToken) return undefined

    // tagName
    const nameToken = this.consume('tagName')
    if (!nameToken) return undefined
    const tagName = nameToken.text.toLowerCase()

    // attrs
    const attrs: Record<string, MetaValue> = {}
    while (this.peek().type === 'attrName') {
      const attrName = this.consume('attrName')!.text
      let attrValue: MetaValue = true // 默认 true (如 disabled)
      
      if (this.peek().type === 'equals') {
        this.consume('equals')
        const valToken = this.consume('attrValue')
        if (valToken) {
          attrValue = valToken.text
        }
      }
      attrs[attrName] = attrValue
    }

    // > or />
    if (this.peek().type === 'selfClosingTagClose') {
      const closeToken = this.consume('selfClosingTagClose')!
      return {
        type: 'Element',
        name: tagName,
        attrs,
        span: { start: startToken.span.start.offset, end: closeToken.span.end.offset, ctxt: 0 },
        loc: { start: startToken.span.start, end: closeToken.span.end },
      }
    }

    this.consume('startTagClose')
    
    // Children
    const children: SyntaxNode[] = []
    // 只有非自闭合标签才有 children
    // 对于 void elements (如 img, br, input)，HTML 规范说不需要闭合标签
    // 这里简单处理：如果是常见的 void elements，就不解析 children
    const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
    
    if (!voidElements.includes(tagName)) {
      while (!this.isEnd()) {
        if (this.peek().type === 'endTagOpen') {
          // 检查是否是当前标签的闭合
          // 这里需要 lookahead
          let i = 1
          while (this.peek(i).type !== 'tagName' && this.peek(i).type !== 'eof') i++
          if (this.peek(i).text.toLowerCase() === tagName) {
            break
          } else {
            // 嵌套不匹配或者是父级的闭合？
            // 简单处理：如果是闭合标签但不是自己的，假设是父级的，结束自己
             break
          }
        }
        
        const startIndex = this.index
        const child = this.parseNode()
        if (child) {
            children.push(child)
        } else if (this.index === startIndex) {
             // 只有在未消费任何 token 时才强制前进，避免死循环
             // 注意：如果是 endTagOpen，会在下一次循环开头处理，这里不应 advance
             if (this.peek().type !== 'endTagOpen') {
                 this.advance()
             }
        }
      }
      
      // </
      this.consume('endTagOpen')
      // tagName
      this.consume('tagName')
      // >
      const endToken = this.consume('startTagClose')
      
      return {
        type: 'Element',
        name: tagName,
        attrs,
        children,
        span: { start: startToken.span.start.offset, end: (endToken?.span.end ?? this.peek(-1).span.end).offset, ctxt: 0 },
        loc: { start: startToken.span.start, end: endToken?.span.end ?? this.peek(-1).span.end },
      }
    } else {
      return {
        type: 'Element',
        name: tagName,
        attrs,
        span: { start: startToken.span.start.offset, end: this.peek(-1).span.end.offset, ctxt: 0 },
        loc: { start: startToken.span.start, end: this.peek(-1).span.end },
      }
    }
  }

  private peek(offset = 0): HtmlToken {
    return this.tokens[this.index + offset] || { type: 'eof', text: '', span: { start: { line:0,column:0,offset:0 }, end: { line:0,column:0,offset:0 } } }
  }

  private advance(): HtmlToken {
    const token = this.tokens[this.index]
    this.index++
    return token!
  }
  
  private isEnd(): boolean {
    return this.index >= this.tokens.length || this.tokens[this.index]?.type === 'eof'
  }

  private consume(type: HtmlTokenType): HtmlToken | undefined {
    if (this.peek().type === type) {
      return this.advance()
    }
    return undefined
  }
}

/**
 * 原生 HTML 适配器。
 *
 * 使用纯 JS 实现的 HtmlParser 将 HTML 字符串解析为 SyntaxNode[]。
 * 不再依赖浏览器的 DOMParser。
 */
export class HtmlAdapter implements Adapter {
  readonly name: string = 'html'

  /**
   * 判断输入文本是否为 HTML 结构。
   *
   * @param text - 输入文本
   * @returns 是否以 `<` 开头（简易检测）
   */
  supports(text: string): boolean {
    return text.trimStart().startsWith('<')
  }

  /**
   * 将 HTML 字符串解析为 SyntaxNode[]。
   *
   * @param text - HTML 文本
   * @returns 解析结果
   */
  parse(text: string): AdaptResult {
    const parser = new HtmlParser()
    return parser.parse(text)
  }
}
