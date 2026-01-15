import type { Diagnostic, SourcePoint, SourceSpan } from '../syntax/diagnostic'

export type TokenType =
  | 'identifier'
  | 'number'
  | 'string'
  | 'arrow'
  | 'braceOpen'
  | 'braceClose'
  | 'equals'
  | 'newline'
  | 'end'

export interface Token {
  type: TokenType
  text: string
  span: SourceSpan
}

export interface TokenizeResult {
  tokens: Token[]
  diagnostics: Diagnostic[]
}

class TextTokenizer {
  private readonly text: string
  private readonly diagnostics: Diagnostic[] = []
  private readonly tokens: Token[] = []

  private index = 0
  private line = 1
  private column = 1

  constructor(text: string) {
    this.text = text
  }

  tokenize(): TokenizeResult {
    while (this.index < this.text.length) {
      if (this.skipWhitespace()) continue
      if (this.readNewline()) continue
      if (this.skipComment()) continue

      const hasToken =
        this.readSingle('{', 'braceOpen') ||
        this.readSingle('}', 'braceClose') ||
        this.readSingle('=', 'equals') ||
        this.readArrow() ||
        this.readString() ||
        this.readNumber() ||
        this.readIdentifier()

      if (hasToken) continue
      this.readUnknown()
    }

    const endPoint = this.point()
    this.addToken('end', '', endPoint, endPoint)
    return { tokens: this.tokens, diagnostics: this.diagnostics }
  }

  private currentChar(): string {
    return this.text[this.index] ?? ''
  }

  private nextChar(offset = 1): string {
    return this.text[this.index + offset] ?? ''
  }

  private point(): SourcePoint {
    return createPoint(this.line, this.column, this.index)
  }

  private advanceChar(): string {
    const char = this.currentChar()
    this.index += 1
    if (char === '\n') {
      this.line += 1
      this.column = 1
      return char
    }
    this.column += 1
    return char
  }

  private addToken(type: TokenType, tokenText: string, start: SourcePoint, end: SourcePoint): void {
    this.tokens.push({ type, text: tokenText, span: createSpan(start, end) })
  }

  private addError(message: string, span?: SourceSpan): void {
    this.diagnostics.push({ level: 'error', code: 'tokenize', message, span })
  }

  private skipWhitespace(): boolean {
    const char = this.currentChar()
    if (char === ' ' || char === '\t' || char === '\r') {
      this.advanceChar()
      return true
    }
    return false
  }

  private readNewline(): boolean {
    if (this.currentChar() !== '\n') return false
    const start = this.point()
    this.advanceChar()
    const end = this.point()
    this.addToken('newline', '\n', start, end)
    return true
  }

  private skipComment(): boolean {
    const char = this.currentChar()
    if (char === '#') return this.skipCommentLine()
    if (char === '/' && this.nextChar() === '/') return this.skipCommentLine()
    return false
  }

  private skipCommentLine(): boolean {
    while (this.index < this.text.length && this.currentChar() !== '\n') this.advanceChar()
    return true
  }

  private readSingle(char: string, type: TokenType): boolean {
    if (this.currentChar() !== char) return false
    const start = this.point()
    this.advanceChar()
    const end = this.point()
    this.addToken(type, char, start, end)
    return true
  }

  private readArrow(): boolean {
    if (this.currentChar() !== '-' || this.nextChar() !== '>') return false
    const start = this.point()
    this.advanceChar()
    this.advanceChar()
    const end = this.point()
    this.addToken('arrow', '->', start, end)
    return true
  }

  private readString(): boolean {
    const char = this.currentChar()
    if (char !== '"' && char !== "'") return false
    const quote = char
    const start = this.point()
    this.advanceChar()

    const value = this.readStringValue(quote, start)
    if (this.currentChar() === quote) this.advanceChar()

    const end = this.point()
    this.addToken('string', value, start, end)
    return true
  }

  private readStringValue(quote: string, start: SourcePoint): string {
    let value = ''
    while (this.index < this.text.length && this.currentChar() !== quote) {
      if (this.currentChar() === '\\') {
        this.advanceChar()
        value += this.readEscaped(quote)
        continue
      }
      value += this.advanceChar()
    }

    if (this.currentChar() !== quote) {
      const span = createSpan(start, this.point())
      this.addError('Unclosed string literal', span)
    }
    return value
  }

  private readEscaped(quote: string): string {
    const escaped = this.currentChar()
    const value = this.toEscapedValue(escaped, quote)
    if (escaped) this.advanceChar()
    return value
  }

  private toEscapedValue(escaped: string, quote: string): string {
    if (escaped === 'n') return '\n'
    if (escaped === 't') return '\t'
    if (escaped === 'r') return '\r'
    if (escaped === quote) return quote
    if (escaped === '\\') return '\\'
    return escaped
  }

  private readNumber(): boolean {
    const char = this.currentChar()
    if (!isDigit(char)) return false

    const start = this.point()
    const value = this.readNumberValue()
    const end = this.point()
    this.addToken('number', value, start, end)
    return true
  }

  private readNumberValue(): string {
    let value = ''
    while (this.index < this.text.length && isDigit(this.currentChar())) value += this.advanceChar()
    if (this.currentChar() === '.' && isDigit(this.nextChar())) {
      value += this.advanceChar()
      while (this.index < this.text.length && isDigit(this.currentChar())) value += this.advanceChar()
    }
    return value
  }

  private readIdentifier(): boolean {
    const char = this.currentChar()
    if (!isIdentifierStart(char)) return false

    const start = this.point()
    let value = ''
    while (this.index < this.text.length && isIdentifierPart(this.currentChar())) value += this.advanceChar()
    const end = this.point()
    this.addToken('identifier', value, start, end)
    return true
  }

  private readUnknown(): void {
    const start = this.point()
    const char = this.currentChar()
    this.advanceChar()
    const end = this.point()
    const span = createSpan(start, end)
    this.addError(`Unexpected character: ${JSON.stringify(char)}`, span)
  }
}

function createPoint(line: number, column: number, offset: number): SourcePoint {
  return { line, column, offset }
}

function createSpan(start: SourcePoint, end: SourcePoint): SourceSpan {
  return { start, end }
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char)
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_-]/.test(char)
}

function isDigit(char: string): boolean {
  return /[0-9]/.test(char)
}

/**
 * 将 DSL 文本切分为 token 流，并附带源位置与诊断信息。
 *
 * @param text - DSL 源文本
 * @returns Token 流与诊断信息（不抛异常）
 */
export function tokenizeText(text: string): TokenizeResult {
  return new TextTokenizer(text).tokenize()
}
