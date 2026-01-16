import type { Diagnostic, SourcePoint, SourceSpan } from '../../syntax/diagnostic'
import { createPoint, createSpan } from '../shared/source'

export type HtmlTokenType =
  | 'startTagOpen'
  | 'startTagClose'
  | 'endTagOpen'
  | 'selfClosingTagClose'
  | 'tagName'
  | 'attrName'
  | 'equals'
  | 'attrValue'
  | 'text'
  | 'comment'
  | 'doctype'
  | 'eof'

export interface HtmlToken {
  type: HtmlTokenType
  text: string
  span: SourceSpan
}

export interface HtmlTokenizeResult {
  tokens: HtmlToken[]
  diagnostics: Diagnostic[]
}

export class HtmlLexer {
  private readonly text: string
  private readonly tokens: HtmlToken[] = []
  private readonly diagnostics: Diagnostic[] = []

  private index = 0
  private line = 1
  private column = 1

  constructor(text: string) {
    this.text = text
  }

  tokenize(): HtmlTokenizeResult {
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
      this.advanceChar()
      this.advanceChar()
      this.advanceChar()
      this.advanceChar()
      text += '<!--'

      while (this.index < this.text.length && !(this.peek() === '-' && this.peek(1) === '-' && this.peek(2) === '>')) {
        text += this.advanceChar()
      }

      if (this.index < this.text.length) {
        this.advanceChar()
        this.advanceChar()
        this.advanceChar()
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
      const start = this.point()
      let text = ''
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

    const start = this.point()
    this.advanceChar()
    const end = this.point()
    this.addToken('startTagOpen', '<', start, end)

    this.readTagName()
    this.readAttributes()
    this.readTagClose()

    return true
  }

  private readEndTagOpen(): boolean {
    if (this.peek() !== '<' || this.peek(1) !== '/') return false

    const start = this.point()
    this.advanceChar()
    this.advanceChar()
    const end = this.point()
    this.addToken('endTagOpen', '</', start, end)

    this.readTagName()
    this.skipWhitespace()

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

      const start = this.point()
      let name = ''
      while (/[^=\s/>]/.test(this.peek()) && this.index < this.text.length) {
        name += this.advanceChar()
      }
      const end = this.point()
      if (name) {
        this.addToken('attrName', name, start, end)
      }

      this.skipWhitespace()

      if (this.peek() === '=') {
        const s = this.point()
        this.advanceChar()
        const e = this.point()
        this.addToken('equals', '=', s, e)

        this.skipWhitespace()
        this.readAttrValue()
      }
    }
  }

  private readAttrValue(): void {
    const quote = this.peek()
    if (quote === '"' || quote === "'") {
      const start = this.point()
      this.advanceChar()

      let value = ''
      while (this.peek() !== quote && this.index < this.text.length) {
        value += this.advanceChar()
      }

      this.advanceChar()
      const end = this.point()
      this.addToken('attrValue', value, start, end)
    } else {
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

