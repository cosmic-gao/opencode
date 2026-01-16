import type { Diagnostic, SourcePoint, SourceSpan } from '../../syntax/diagnostic'
import type { MetaValue, SyntaxNode } from '../../syntax/node'
import { createPoint, createSpan } from '../shared/source'
import { JsLexer } from './lexer'

type JsTokenType =
  | 'keyword' // import, export, const, let, var, function, return, if, else, for, while
  | 'identifier' // myVar
  | 'string' // "hello", 'world'
  | 'number' // 123
  | 'operator' // +, -, *, /, =, ==, ===, =>, ...
  | 'punctuation' // {, }, (, ), [, ], ;, ,, .
  | 'comment' // //, /* */
  | 'jsxTagOpen' // <div
  | 'jsxTagClose' // >
  | 'jsxEndTagOpen' // </div
  | 'jsxSelfClosing' // />
  | 'jsxText'
  | 'whitespace'
  | 'eof'

interface JsToken {
  type: JsTokenType
  text: string
  span: SourceSpan
}

class JsTokenizer {
  private readonly text: string
  private readonly tokens: JsToken[] = []
  private readonly diagnostics: Diagnostic[] = []
  
  private index = 0
  private line = 1
  private column = 1
  private inJsxTag = false

  private static readonly KEYWORDS = new Set([
    'import', 'export', 'default', 'from', 'as',
    'const', 'let', 'var',
    'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break',
    'class', 'extends', 'new', 'this', 'super',
    'try', 'catch', 'finally', 'throw',
    'async', 'await',
    'interface', 'type', 'enum' // TS keywords
  ])

  constructor(text: string) {
    this.text = text
  }

  tokenize(): { tokens: JsToken[]; diagnostics: Diagnostic[] } {
    while (this.index < this.text.length) {
      if (this.readWhitespace()) continue
      if (this.readComment()) continue
      
      // JSX Handling
      if (this.readJsxTag()) continue
      
      if (this.readString()) continue
      if (this.readNumber()) continue
      if (this.readIdentifierOrKeyword()) continue
      if (this.readOperatorOrPunctuation()) continue
      
      // Unknown
      this.advanceChar()
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

  private addToken(type: JsTokenType, text: string, start: SourcePoint, end: SourcePoint) {
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
    if (this.peek() === '/' && this.peek(1) === '/') {
      const start = this.point()
      let text = ''
      while (this.index < this.text.length && this.peek() !== '\n') {
        text += this.advanceChar()
      }
      const end = this.point()
      this.addToken('comment', text, start, end)
      return true
    }
    
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

  private readJsxTag(): boolean {
    // 简单的 JSX 识别逻辑：如果 < 后面跟着标识符，且前一个 token 不是表达式的一部分（这里简化处理）
    // 或者我们直接尝试解析，如果是合法的 JSX 标签开头
    
    // Start Tag: <div
    if (this.peek() === '<' && /[a-zA-Z]/.test(this.peek(1))) {
      const start = this.point()
      this.advanceChar() // <
      let text = '<'
      while (/[a-zA-Z0-9\-\.]/.test(this.peek())) {
        text += this.advanceChar()
      }
      const end = this.point()
      this.addToken('jsxTagOpen', text, start, end)
      this.inJsxTag = true
      return true
    }
    
    // End Tag: </div
    if (this.peek() === '<' && this.peek(1) === '/' && /[a-zA-Z]/.test(this.peek(2))) {
      const start = this.point()
      this.advanceChar(); this.advanceChar() // </
      let text = '</'
      while (/[a-zA-Z0-9\-\.]/.test(this.peek())) {
        text += this.advanceChar()
      }
      const end = this.point()
      this.addToken('jsxEndTagOpen', text, start, end)
      this.inJsxTag = false // end tag closes the context locally? no, context is complex
      return true
    }
    
    if (this.inJsxTag) {
        // Tag Close: >
        if (this.peek() === '>') {
            const start = this.point()
            this.advanceChar()
            this.addToken('jsxTagClose', '>', start, this.point())
            this.inJsxTag = false
            return true
        }
        
        // Self Closing: />
        if (this.peek() === '/' && this.peek(1) === '>') {
            const start = this.point()
            this.advanceChar(); this.advanceChar()
            this.addToken('jsxSelfClosing', '/>', start, this.point())
            this.inJsxTag = false
            return true
        }
    }
    
    return false
  }

  private readString(): boolean {
    const quote = this.peek()
    if (quote !== '"' && quote !== "'" && quote !== '`') return false
    
    const start = this.point()
    let text = this.advanceChar()
    
    while (this.index < this.text.length) {
      const char = this.peek()
      if (char === '\\') {
        text += this.advanceChar()
        if (this.index < this.text.length) text += this.advanceChar()
        continue
      }
      if (char === quote) {
        text += this.advanceChar()
        break
      }
      text += this.advanceChar()
    }
    
    const end = this.point()
    this.addToken('string', text, start, end)
    return true
  }

  private readNumber(): boolean {
    if (!/[0-9]/.test(this.peek())) return false
    
    const start = this.point()
    let text = ''
    while (/[0-9]/.test(this.peek())) {
      text += this.advanceChar()
    }
    if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
      text += this.advanceChar()
      while (/[0-9]/.test(this.peek())) {
        text += this.advanceChar()
      }
    }
    const end = this.point()
    this.addToken('number', text, start, end)
    return true
  }

  private readIdentifierOrKeyword(): boolean {
    if (!/[a-zA-Z_$]/.test(this.peek())) return false
    
    const start = this.point()
    let text = ''
    while (/[a-zA-Z0-9_\-$]/.test(this.peek())) { // JSX attributes can have -
      text += this.advanceChar()
    }
    const end = this.point()
    
    const type = JsTokenizer.KEYWORDS.has(text) ? 'keyword' : 'identifier'
    this.addToken(type, text, start, end)
    return true
  }

  private readOperatorOrPunctuation(): boolean {
    const char = this.peek()
    const start = this.point()
    
    // Multi-char operators
    const twoChars = char + this.peek(1)
    const threeChars = twoChars + this.peek(2)
    
    if (['===', '!==', '...', '>>>', '<<=', '>>='].includes(threeChars)) {
      this.advanceChar(); this.advanceChar(); this.advanceChar()
      this.addToken('operator', threeChars, start, this.point())
      return true
    }
    
    if (['==', '!=', '<=', '>=', '=>', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '??', '?.', '<<', '>>'].includes(twoChars)) {
      this.advanceChar(); this.advanceChar()
      this.addToken('operator', twoChars, start, this.point())
      return true
    }
    
    // Single-char
    if ('{}()[].,;'.includes(char)) {
      this.advanceChar()
      this.addToken('punctuation', char, start, this.point())
      return true
    }
    
    if ('+-*/%=<>!&|^~?:'.includes(char)) {
      this.advanceChar()
      this.addToken('operator', char, start, this.point())
      return true
    }
    
    return false
  }
}

void JsTokenizer

export class JsParser {
  private tokens: JsToken[] = []
  private index = 0
  private diagnostics: Diagnostic[] = []
  private source: string = ''

  parse(text: string): { nodes: SyntaxNode[]; diagnostics: Diagnostic[] } {
    this.source = text
    const lexer = new JsLexer(text)
    const result = lexer.tokenize()
    this.tokens = result.tokens
    this.diagnostics = result.diagnostics
    this.index = 0

    const nodes: SyntaxNode[] = []
    
    while (!this.isEnd()) {
      const node = this.parseStatement()
      if (node) nodes.push(node)
      else this.advance() // Skip unknown
    }

    return { nodes, diagnostics: this.diagnostics }
  }

  private getSource(start: SourcePoint, end: SourcePoint): string {
      return this.source.slice(start.offset, end.offset)
  }


  private previous(): JsToken {
    return this.tokens[this.index - 1] || { type: 'eof', text: '', span: { start: { line:0,column:0,offset:0 }, end: { line:0,column:0,offset:0 } } }
  }

  private peek(offset = 0): JsToken {
    return this.tokens[this.index + offset] || { type: 'eof', text: '', span: { start: { line:0,column:0,offset:0 }, end: { line:0,column:0,offset:0 } } }
  }

  private advance(): JsToken {
    const token = this.tokens[this.index]
    this.index++
    return token!
  }
  
  private isEnd(): boolean {
    return this.index >= this.tokens.length || this.tokens[this.index]?.type === 'eof'
  }

  private match(type: JsTokenType, text?: string): boolean {
    const token = this.peek()
    if (token.type !== type) return false
    if (text !== undefined && token.text !== text) return false
    return true
  }

  private consume(type: JsTokenType): JsToken | undefined {
    if (this.match(type)) {
      return this.advance()
    }
    return undefined
  }

  // 简易的语句解析
  private parseStatement(): SyntaxNode | undefined {
    // JSX Element?
    if (this.match('jsxTagOpen')) {
      return this.parseJsxElement()
    }

    if (this.match('keyword', 'import')) {
      return this.parseImport()
    }
    if (this.match('keyword', 'export')) {
      return this.parseExport()
    }
    if (this.match('keyword', 'const') || this.match('keyword', 'let') || this.match('keyword', 'var')) {
      return this.parseVariableDeclaration()
    }
    if (this.match('keyword', 'function')) {
      return this.parseFunctionDeclaration()
    }
    if (this.match('keyword', 'return')) {
        return this.parseReturnStatement()
    }
    
    // Fallback: collect tokens until semicolon or newline
    return this.parseUnknownStatement()
  }

  private parseJsxElement(): SyntaxNode | undefined {
    const startToken = this.consume('jsxTagOpen')
    if (!startToken) return undefined
    
    const tagName = startToken.text.substring(1) // remove <
    const attrs: Record<string, MetaValue> = {}
    
    // Attributes
    while (!this.isEnd() && !this.match('jsxTagClose') && !this.match('jsxSelfClosing')) {
      if (this.match('identifier')) {
        const name = this.advance().text
        let value: MetaValue = true
        if (this.match('operator', '=')) {
          this.advance() // =
          if (this.match('string')) {
            value = this.advance().text.replace(/^['"]|['"]$/g, '')
          } else if (this.match('punctuation', '{')) {
             // JSX Expression { ... }
             this.advance() // {
             // 简单跳过表达式内容
             let braceCount = 1
             let expr = ''
             while (braceCount > 0 && !this.isEnd()) {
                if (this.match('punctuation', '{')) braceCount++
                if (this.match('punctuation', '}')) braceCount--
                if (braceCount > 0) expr += this.advance().text
             }
             this.advance() // }
             value = expr // 简化：将表达式存为值
          }
        }
        attrs[name] = value
      } else {
        this.advance() // skip unknown inside tag
      }
    }
    
    if (this.match('jsxSelfClosing')) {
      const endToken = this.advance()
      return {
        type: 'JsxElement',
        attrs: { tagName, ...attrs },
        span: { start: startToken.span.start.offset, end: endToken.span.end.offset, ctxt: 0 },
        loc: { start: startToken.span.start, end: endToken.span.end },
      }
    }
    
    this.consume('jsxTagClose')
    
    // Children
    const children: SyntaxNode[] = []
    while (!this.isEnd() && !this.match('jsxEndTagOpen')) {
        // Text content or child elements
        // 这里需要更复杂的逻辑来处理 JSX 文本和子元素
        // 简化：如果遇到 <，尝试解析为子元素；否则当作文本
        if (this.match('jsxTagOpen')) {
            const child = this.parseJsxElement()
            if (child) children.push(child)
        } else {
            // Text or Expression
            const token = this.advance()
            // 简单处理文本
            if (token.type !== 'jsxEndTagOpen') {
               // merge text?
            }
        }
    }
    
    this.consume('jsxEndTagOpen')
    // 闭合标签名应该匹配
    // this.consume('identifier') 
    // >
    const endToken = this.consume('jsxTagClose') || this.peek(-1)
    
    return {
        type: 'JsxElement',
        attrs: { tagName, ...attrs },
        children,
        span: { start: startToken.span.start.offset, end: endToken.span.end.offset, ctxt: 0 },
        loc: { start: startToken.span.start, end: endToken.span.end },
    }
  }

  private parseImport(): SyntaxNode {
    const start = this.peek().span.start
    let text = ''

    // Consume 'import' keyword if present
    if (this.match('keyword', 'import')) {
      text += this.advance().text + ' '
    }

    while (!this.isEnd() && !this.match('punctuation', ';') && !this.match('keyword', 'import')) { // simple boundary
       text += this.advance().text + ' '
    }
    if (this.match('punctuation', ';')) {
      text += this.advance().text
    }
    const end = this.previous().span.end
    
    return {
      type: 'ImportDeclaration',
      attrs: { text: text.trim() },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private parseExport(): SyntaxNode {
    const start = this.peek().span.start
    let text = ''
    
    // Consume 'export' keyword if present
    if (this.match('keyword', 'export')) {
      text += this.advance().text + ' '
    }

    // 简单处理 export default ... 或 export const ...
    while (!this.isEnd() && !this.match('punctuation', ';') && this.peek().span.start.line === start.line) {
       text += this.advance().text + ' '
    }
    // if semicolon
    if (this.match('punctuation', ';')) {
      text += this.advance().text
    }
    const end = this.previous().span.end
    
    return {
      type: 'ExportDeclaration',
      attrs: { text: text.trim() },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private parseVariableDeclaration(): SyntaxNode {
    const start = this.peek().span.start
    let text = ''
    const children: SyntaxNode[] = []
    let kind: string | undefined
    
    // consume keyword
    if (this.match('keyword', 'const') || this.match('keyword', 'let') || this.match('keyword', 'var')) {
        kind = this.advance().text
    }
    
    while (!this.isEnd() && !this.match('punctuation', ';')) {
      if (this.match('punctuation', ',')) {
        this.advance()
        continue
      }

      const declaratorStart = this.peek().span.start
      if (!this.match('identifier')) {
        const startIndex = this.index
        while (!this.isEnd() && !this.match('punctuation', ',') && !this.match('punctuation', ';')) {
          if (this.match('jsxTagOpen')) {
            this.parseJsxElement()
            continue
          }
          this.advance()
        }
        const endPoint = this.previous().span.end
        const raw = this.getSource(declaratorStart, endPoint).trim()
        const attrs: Record<string, MetaValue> = { text: raw }
        if (kind) attrs.kind = kind
        children.push({
          type: 'VariableDeclarator',
          attrs,
          span: { start: declaratorStart.offset, end: endPoint.offset, ctxt: 0 },
          loc: { start: declaratorStart, end: endPoint },
        })
        if (this.index === startIndex) this.advance()
        continue
      }

      const idToken = this.advance()
      const idNode: SyntaxNode = {
        type: 'Identifier',
        attrs: { name: idToken.text },
        span: { start: idToken.span.start.offset, end: idToken.span.end.offset, ctxt: 0 },
        loc: idToken.span,
      }

      let initNode: SyntaxNode | undefined
      if (this.match('operator', '=')) {
        this.advance()
        initNode = this.parseInitializer()
      }

      const endPoint = (initNode?.loc?.end ?? idToken.span.end)
      const declaratorAttrs: Record<string, MetaValue> = { id: idToken.text }
      if (kind) declaratorAttrs.kind = kind
      const declarator: SyntaxNode = {
        type: 'VariableDeclarator',
        attrs: declaratorAttrs,
        children: initNode ? [idNode, initNode] : [idNode],
        span: { start: declaratorStart.offset, end: endPoint.offset, ctxt: 0 },
        loc: { start: declaratorStart, end: endPoint },
      }
      children.push(declarator)
    }
    
    if (this.match('punctuation', ';')) {
      this.advance()
    }
    const end = this.previous().span.end
    
    // 使用 source 截取完整文本，包括 JSX 部分
    text = this.getSource(start, end)
    
    const attrs: Record<string, MetaValue> = { text: text.trim() }
    if (kind) attrs.kind = kind
    return {
      type: 'VariableStatement',
      attrs,
      children: children.length ? children : undefined,
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private parseInitializer(): SyntaxNode {
    const start = this.peek().span.start
    if (this.match('string')) {
      const token = this.advance()
      const value = token.text.replace(/^['"`]|['"`]$/g, '')
      return {
        type: 'Literal',
        attrs: { kind: 'string', value },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }
    if (this.match('number')) {
      const token = this.advance()
      return {
        type: 'Literal',
        attrs: { kind: 'number', value: Number(token.text) },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }
    if (this.match('identifier')) {
      const token = this.advance()
      return {
        type: 'Identifier',
        attrs: { name: token.text },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }
    if (this.match('jsxTagOpen')) {
      return this.parseJsxElement() ?? this.parseExpressionText(start)
    }
    return this.parseExpressionText(start)
  }

  private parseExpressionText(start: SourcePoint): SyntaxNode {
    const startIndex = this.index
    let paren = 0
    let square = 0
    let brace = 0
    while (!this.isEnd()) {
      if (paren === 0 && square === 0 && brace === 0 && (this.match('punctuation', ',') || this.match('punctuation', ';'))) break
      if (this.match('punctuation', '(')) paren += 1
      else if (this.match('punctuation', ')')) paren = Math.max(0, paren - 1)
      else if (this.match('punctuation', '[')) square += 1
      else if (this.match('punctuation', ']')) square = Math.max(0, square - 1)
      else if (this.match('punctuation', '{')) brace += 1
      else if (this.match('punctuation', '}')) brace = Math.max(0, brace - 1)
      if (this.match('jsxTagOpen')) {
        this.parseJsxElement()
        continue
      }
      this.advance()
    }
    if (this.index === startIndex) {
      const token = this.advance()
      return {
        type: 'ExpressionText',
        attrs: { text: token.text },
        span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
        loc: token.span,
      }
    }
    const end = this.previous().span.end
    const raw = this.getSource(start, end).trim()
    return {
      type: 'ExpressionText',
      attrs: { text: raw },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }

  private parseFunctionDeclaration(): SyntaxNode {
    const start = this.peek().span.start
    let text = ''
    text += this.advance().text + ' ' // function
    
    // name
    if (this.match('identifier')) {
      text += this.advance().text
    }
    
    // params
    // body block
    // 这里非常简化，直接把整块吞掉
    let braceCount = 0
    let startedBody = false
    
    while (!this.isEnd()) {
      const token = this.peek()
      if (token.text === '{') {
        braceCount++
        startedBody = true
      } else if (token.text === '}') {
        braceCount--
      }
      
      text += this.advance().text + ' '
      
      if (startedBody && braceCount === 0) break
    }
    
    const end = this.previous().span.end
    
    return {
      type: 'FunctionDeclaration',
      attrs: { text: text.trim() },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }
  
  private parseReturnStatement(): SyntaxNode {
      const start = this.peek().span.start
      let text = ''
      
      if (this.match('keyword', 'return')) {
          this.advance()
      }
      
      // 如果紧接着是 JSX
      if (this.match('punctuation', '(')) {
          // check next
          if (this.tokens[this.index + 1]?.type === 'jsxTagOpen') {
              // return ( <Jsx...
              this.advance() // (
              const jsxNode = this.parseJsxElement()
              if (this.match('punctuation', ')')) this.advance()
              if (this.match('punctuation', ';')) this.advance()
              
              const end = this.previous().span.end
              text = this.getSource(start, end)
              
              return {
                  type: 'ReturnStatement',
                  attrs: { text: text.trim() },
                  children: jsxNode ? [jsxNode] : [],
                  span: { start: start.offset, end: end.offset, ctxt: 0 },
                  loc: { start, end },
              }
          }
      }
      
      if (this.match('jsxTagOpen')) {
          const jsxNode = this.parseJsxElement()
          // consume optional semicolon
          if (this.match('punctuation', ';')) {
              this.advance()
              // update end? no, statement usually includes semicolon
          }
           // re-calc end including semicolon
          const realEnd = this.previous().span.end
          text = this.getSource(start, realEnd)
          
          return {
              type: 'ReturnStatement',
              attrs: { text: text.trim() },
              children: jsxNode ? [jsxNode] : [],
              span: { start: start.offset, end: realEnd.offset, ctxt: 0 },
              loc: { start, end: realEnd },
          }
      }

      // 普通 return
      while (!this.isEnd() && !this.match('punctuation', ';')) {
          this.advance()
      }
      if (this.match('punctuation', ';')) this.advance()
      
      const end = this.previous().span.end
      text = this.getSource(start, end)
      
      return {
          type: 'ReturnStatement',
          attrs: { text: text.trim() },
          span: { start: start.offset, end: end.offset, ctxt: 0 },
          loc: { start, end },
      }
  }

  private parseUnknownStatement(): SyntaxNode {
    const start = this.peek().span.start
    let text = this.advance().text
    const end = this.previous().span.end
    
    return {
      type: 'Statement',
      attrs: { text },
      span: { start: start.offset, end: end.offset, ctxt: 0 },
      loc: { start, end },
    }
  }
}
