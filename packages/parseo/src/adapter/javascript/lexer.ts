import type { Diagnostic, SourcePoint, SourceSpan } from '../../syntax/diagnostic'
import { createPoint, createSpan } from '../shared/source'

export type JsTokenType =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'operator'
  | 'punctuation'
  | 'comment'
  | 'jsxTagOpen'
  | 'jsxTagClose'
  | 'jsxEndTagOpen'
  | 'jsxSelfClosing'
  | 'jsxText'
  | 'whitespace'
  | 'eof'

export interface JsToken {
  type: JsTokenType
  text: string
  span: SourceSpan
}

export interface JsTokenizeResult {
  tokens: JsToken[]
  diagnostics: Diagnostic[]
}

export class JsLexer {
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
    'interface', 'type', 'enum',
  ])

  constructor(text: string) {
    this.text = text
  }

  tokenize(): JsTokenizeResult {
    while (this.index < this.text.length) {
      if (this.readWhitespace()) continue
      if (this.readComment()) continue

      if (this.readJsxTag()) continue

      if (this.readString()) continue
      if (this.readNumber()) continue
      if (this.readIdentifierOrKeyword()) continue
      if (this.readOperatorOrPunctuation()) continue

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
      this.advanceChar()
      this.advanceChar()
      text += '/*'

      while (this.index < this.text.length && !(this.peek() === '*' && this.peek(1) === '/')) {
        text += this.advanceChar()
      }

      if (this.index < this.text.length) {
        this.advanceChar()
        this.advanceChar()
        text += '*/'
      }

      const end = this.point()
      this.addToken('comment', text, start, end)
      return true
    }

    return false
  }

  private readJsxTag(): boolean {
    if (this.peek() === '<' && /[a-zA-Z]/.test(this.peek(1))) {
      const start = this.point()
      this.advanceChar()
      let text = '<'
      while (/[a-zA-Z0-9\-\.]/.test(this.peek())) {
        text += this.advanceChar()
      }
      const end = this.point()
      this.addToken('jsxTagOpen', text, start, end)
      this.inJsxTag = true
      return true
    }

    if (this.peek() === '<' && this.peek(1) === '/' && /[a-zA-Z]/.test(this.peek(2))) {
      const start = this.point()
      this.advanceChar()
      this.advanceChar()
      let text = '</'
      while (/[a-zA-Z0-9\-\.]/.test(this.peek())) {
        text += this.advanceChar()
      }
      const end = this.point()
      this.addToken('jsxEndTagOpen', text, start, end)
      this.inJsxTag = false
      return true
    }

    if (this.inJsxTag) {
      if (this.peek() === '>') {
        const start = this.point()
        this.advanceChar()
        this.addToken('jsxTagClose', '>', start, this.point())
        this.inJsxTag = false
        return true
      }

      if (this.peek() === '/' && this.peek(1) === '>') {
        const start = this.point()
        this.advanceChar()
        this.advanceChar()
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
    while (/[a-zA-Z0-9_\-$]/.test(this.peek())) {
      text += this.advanceChar()
    }
    const end = this.point()

    const type = JsLexer.KEYWORDS.has(text) ? 'keyword' : 'identifier'
    this.addToken(type, text, start, end)
    return true
  }

  private readOperatorOrPunctuation(): boolean {
    const char = this.peek()
    const start = this.point()

    const twoChars = char + this.peek(1)
    const threeChars = twoChars + this.peek(2)

    if (['===', '!==', '...', '>>>', '<<=', '>>='].includes(threeChars)) {
      this.advanceChar()
      this.advanceChar()
      this.advanceChar()
      this.addToken('operator', threeChars, start, this.point())
      return true
    }

    if (['==', '!=', '<=', '>=', '=>', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '??', '?.', '<<', '>>'].includes(twoChars)) {
      this.advanceChar()
      this.advanceChar()
      this.addToken('operator', twoChars, start, this.point())
      return true
    }

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

