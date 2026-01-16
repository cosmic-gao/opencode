import type { Diagnostic, SourcePoint, SourceSpan } from '../../syntax/diagnostic'
import { createPoint, createSpan } from '../shared/source'

export type CssNumberType = 'integer' | 'number'

export type CssTokenType =
  | 'whitespace'
  | 'comment'
  | 'cdo'
  | 'cdc'
  | 'ident'
  | 'function'
  | 'atKeyword'
  | 'hash'
  | 'string'
  | 'badString'
  | 'url'
  | 'badUrl'
  | 'unicodeRange'
  | 'number'
  | 'percentage'
  | 'dimension'
  | 'colon'
  | 'semicolon'
  | 'comma'
  | 'parenOpen'
  | 'parenClose'
  | 'squareOpen'
  | 'squareClose'
  | 'braceOpen'
  | 'braceClose'
  | 'includeMatch'
  | 'dashMatch'
  | 'prefixMatch'
  | 'suffixMatch'
  | 'substringMatch'
  | 'column'
  | 'delim'
  | 'eof'

export type CssToken =
  | { type: 'whitespace'; text: string; span: SourceSpan }
  | { type: 'comment'; text: string; span: SourceSpan }
  | { type: 'cdo' | 'cdc'; text: string; span: SourceSpan }
  | { type: 'ident'; text: string; span: SourceSpan; value: string }
  | { type: 'function'; text: string; span: SourceSpan; value: string }
  | { type: 'atKeyword'; text: string; span: SourceSpan; value: string }
  | { type: 'hash'; text: string; span: SourceSpan; value: string; hashType: 'id' | 'unrestricted' }
  | { type: 'string' | 'badString'; text: string; span: SourceSpan; value?: string }
  | { type: 'url' | 'badUrl'; text: string; span: SourceSpan; value?: string }
  | { type: 'unicodeRange'; text: string; span: SourceSpan; value: string }
  | { type: 'number'; text: string; span: SourceSpan; repr: string; value: number; numberType: CssNumberType }
  | { type: 'percentage'; text: string; span: SourceSpan; repr: string; value: number; numberType: CssNumberType }
  | { type: 'dimension'; text: string; span: SourceSpan; repr: string; value: number; numberType: CssNumberType; unit: string }
  | {
      type:
        | 'colon'
        | 'semicolon'
        | 'comma'
        | 'parenOpen'
        | 'parenClose'
        | 'squareOpen'
        | 'squareClose'
        | 'braceOpen'
        | 'braceClose'
        | 'includeMatch'
        | 'dashMatch'
        | 'prefixMatch'
        | 'suffixMatch'
        | 'substringMatch'
        | 'column'
      text: string
      span: SourceSpan
    }
  | { type: 'delim'; text: string; span: SourceSpan; value: string }
  | { type: 'eof'; text: ''; span: SourceSpan }

export interface CssTokenizeResult {
  tokens: CssToken[]
  diagnostics: Diagnostic[]
}

export class CssLexer {
  private readonly input: string
  private readonly tokens: CssToken[] = []
  private readonly diagnostics: Diagnostic[] = []

  private index = 0
  private line = 1
  private column = 1

  constructor(text: string) {
    this.input = text
  }

  tokenize(): CssTokenizeResult {
    while (this.index < this.input.length) {
      const char = this.peek()
      if (isWhitespace(char)) {
        this.consumeWhitespace()
        continue
      }

      if (this.startsWith('/*')) {
        this.consumeComment()
        continue
      }

      if (this.startsWith('<!--')) {
        this.consumeFixedToken('cdo', 4)
        continue
      }

      if (this.startsWith('-->')) {
        this.consumeFixedToken('cdc', 3)
        continue
      }

      if (char === '"' || char === "'") {
        this.consumeStringToken(char)
        continue
      }

      if (this.isUnicodeRangeStart()) {
        this.consumeUnicodeRangeToken()
        continue
      }

      if (this.wouldStartNumber()) {
        this.consumeNumericToken()
        continue
      }

      if (this.wouldStartIdent()) {
        this.consumeIdentLikeToken()
        continue
      }

      if (char === '@') {
        if (this.wouldStartIdentAt(1)) {
          const start = this.point()
          this.advanceChar()
          const value = this.consumeName()
          const end = this.point()
          const text = this.input.slice(start.offset, end.offset)
          this.tokens.push({ type: 'atKeyword', text, span: createSpan(start, end), value })
          continue
        }
        this.consumeDelimToken()
        continue
      }

      if (char === '#') {
        if (this.wouldStartNameAt(1) || isValidEscape(this.peek(1), this.peek(2))) {
          const start = this.point()
          this.advanceChar()
          const value = this.consumeName()
          const end = this.point()
          const text = this.input.slice(start.offset, end.offset)
          const hashType = this.wouldStartIdentFrom(value) ? 'id' : 'unrestricted'
          this.tokens.push({ type: 'hash', text, span: createSpan(start, end), value, hashType })
          continue
        }
        this.consumeDelimToken()
        continue
      }

      if (this.consumeMatchOperator()) continue
      if (this.consumeSimpleToken()) continue
      this.consumeDelimToken()
    }

    const endPoint = this.point()
    this.tokens.push({ type: 'eof', text: '', span: createSpan(endPoint, endPoint) })
    return { tokens: this.tokens, diagnostics: this.diagnostics }
  }

  private point(): SourcePoint {
    return createPoint(this.line, this.column, this.index)
  }

  private peek(offset = 0): string {
    return this.input[this.index + offset] ?? ''
  }

  private startsWith(value: string): boolean {
    return this.input.startsWith(value, this.index)
  }

  private advanceChar(): string {
    const char = this.input[this.index] ?? ''
    this.index += 1

    if (char === '\r') {
      if (this.peek() === '\n') {
        this.index += 1
      }
      this.line += 1
      this.column = 1
      return '\n'
    }

    if (char === '\n' || char === '\f') {
      this.line += 1
      this.column = 1
      return '\n'
    }

    this.column += 1
    return char
  }

  private consumeWhitespace(): void {
    const start = this.point()
    while (isWhitespace(this.peek())) this.advanceChar()
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: 'whitespace', text, span: createSpan(start, end) })
  }

  private consumeComment(): void {
    const start = this.point()
    this.advanceChar()
    this.advanceChar()
    while (this.index < this.input.length && !(this.peek() === '*' && this.peek(1) === '/')) {
      this.advanceChar()
    }
    if (this.index >= this.input.length) {
      this.diagnostics.push({ level: 'error', code: 'css', message: 'Unclosed comment', span: createSpan(start, this.point()) })
      const end = this.point()
      const text = this.input.slice(start.offset, end.offset)
      this.tokens.push({ type: 'comment', text, span: createSpan(start, end) })
      return
    }
    this.advanceChar()
    this.advanceChar()
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: 'comment', text, span: createSpan(start, end) })
  }

  private consumeFixedToken(type: 'cdo' | 'cdc', length: number): void {
    const start = this.point()
    for (let i = 0; i < length; i += 1) this.advanceChar()
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type, text, span: createSpan(start, end) })
  }

  private consumeStringToken(ending: string): void {
    const start = this.point()
    this.advanceChar()
    let value = ''
    while (this.index < this.input.length) {
      const char = this.peek()
      if (char === ending) {
        this.advanceChar()
        const end = this.point()
        const text = this.input.slice(start.offset, end.offset)
        this.tokens.push({ type: 'string', text, span: createSpan(start, end), value })
        return
      }
      if (isNewline(char)) {
        const end = this.point()
        const text = this.input.slice(start.offset, end.offset)
        this.diagnostics.push({ level: 'error', code: 'css', message: 'Unterminated string', span: createSpan(start, end) })
        this.tokens.push({ type: 'badString', text, span: createSpan(start, end) })
        return
      }
      if (char === '\\') {
        this.advanceChar()
        if (isNewline(this.peek())) {
          this.advanceChar()
          continue
        }
        if (this.index < this.input.length) {
          value += this.consumeEscapedCodePoint()
          continue
        }
      }
      value += this.advanceChar()
    }
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.diagnostics.push({ level: 'error', code: 'css', message: 'Unterminated string', span: createSpan(start, end) })
    this.tokens.push({ type: 'string', text, span: createSpan(start, end), value })
  }

  private consumeIdentLikeToken(): void {
    const start = this.point()
    const name = this.consumeName()
    const nameLower = name.toLowerCase()
    if (this.peek() === '(') {
      this.advanceChar()
      if (nameLower === 'url') {
        while (isWhitespace(this.peek())) this.advanceChar()
        const next = this.peek()
        if (next === '"' || next === "'") {
          const end = this.point()
          const text = this.input.slice(start.offset, end.offset)
          this.tokens.push({ type: 'function', text, span: createSpan(start, end), value: name })
          return
        }
        this.consumeUrlToken(start)
        return
      }
      const end = this.point()
      const text = this.input.slice(start.offset, end.offset)
      this.tokens.push({ type: 'function', text, span: createSpan(start, end), value: name })
      return
    }
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: 'ident', text, span: createSpan(start, end), value: name })
  }

  private consumeUrlToken(startPoint: SourcePoint): void {
    const urlStart = startPoint
    let value = ''
    while (isWhitespace(this.peek())) this.advanceChar()
    while (this.index < this.input.length) {
      const char = this.peek()
      if (char === ')') {
        this.advanceChar()
        const end = this.point()
        const text = this.input.slice(urlStart.offset, end.offset)
        this.tokens.push({ type: 'url', text, span: createSpan(urlStart, end), value })
        return
      }
      if (isWhitespace(char)) {
        while (isWhitespace(this.peek())) this.advanceChar()
        if (this.peek() === ')') {
          this.advanceChar()
          const end = this.point()
          const text = this.input.slice(urlStart.offset, end.offset)
          this.tokens.push({ type: 'url', text, span: createSpan(urlStart, end), value })
          return
        }
        this.consumeBadUrl(urlStart)
        return
      }
      if (char === '"' || char === "'" || char === '(' || isNonPrintable(char)) {
        this.consumeBadUrl(urlStart)
        return
      }
      if (char === '\\') {
        if (isValidEscape(char, this.peek(1))) {
          this.advanceChar()
          value += this.consumeEscapedCodePoint()
          continue
        }
        this.consumeBadUrl(urlStart)
        return
      }
      value += this.advanceChar()
    }
    const end = this.point()
    const text = this.input.slice(urlStart.offset, end.offset)
    this.diagnostics.push({ level: 'error', code: 'css', message: 'Unterminated url()', span: createSpan(urlStart, end) })
    this.tokens.push({ type: 'badUrl', text, span: createSpan(urlStart, end) })
  }

  private consumeBadUrl(startPoint: SourcePoint): void {
    while (this.index < this.input.length) {
      const char = this.peek()
      if (char === ')') {
        this.advanceChar()
        const end = this.point()
        const text = this.input.slice(startPoint.offset, end.offset)
        this.tokens.push({ type: 'badUrl', text, span: createSpan(startPoint, end) })
        return
      }
      if (isValidEscape(char, this.peek(1))) {
        this.advanceChar()
        this.consumeEscapedCodePoint()
        continue
      }
      this.advanceChar()
    }
    const end = this.point()
    const text = this.input.slice(startPoint.offset, end.offset)
    this.tokens.push({ type: 'badUrl', text, span: createSpan(startPoint, end) })
  }

  private consumeUnicodeRangeToken(): void {
    const start = this.point()
    this.advanceChar()
    this.advanceChar()
    let body = ''
    let count = 0
    while (count < 6 && (isHexDigit(this.peek()) || this.peek() === '?')) {
      body += this.advanceChar()
      count += 1
    }
    if (this.peek() === '-' && isHexDigit(this.peek(1))) {
      body += this.advanceChar()
      let count2 = 0
      while (count2 < 6 && isHexDigit(this.peek())) {
        body += this.advanceChar()
        count2 += 1
      }
    }
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: 'unicodeRange', text, span: createSpan(start, end), value: text })
  }

  private consumeNumericToken(): void {
    const start = this.point()
    const number = this.consumeNumber()
    if (this.wouldStartIdent()) {
      const unit = this.consumeName()
      const end = this.point()
      const text = this.input.slice(start.offset, end.offset)
      this.tokens.push({
        type: 'dimension',
        text,
        span: createSpan(start, end),
        repr: number.repr,
        value: number.value,
        numberType: number.numberType,
        unit,
      })
      return
    }
    if (this.peek() === '%') {
      this.advanceChar()
      const end = this.point()
      const text = this.input.slice(start.offset, end.offset)
      this.tokens.push({
        type: 'percentage',
        text,
        span: createSpan(start, end),
        repr: number.repr,
        value: number.value,
        numberType: number.numberType,
      })
      return
    }
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: 'number', text, span: createSpan(start, end), repr: number.repr, value: number.value, numberType: number.numberType })
  }

  private consumeNumber(): { repr: string; value: number; numberType: CssNumberType } {
    let repr = ''
    if (this.peek() === '+' || this.peek() === '-') repr += this.advanceChar()
    while (isDigit(this.peek())) repr += this.advanceChar()
    let isInt = true
    if (this.peek() === '.' && isDigit(this.peek(1))) {
      isInt = false
      repr += this.advanceChar()
      while (isDigit(this.peek())) repr += this.advanceChar()
    }
    const c = this.peek()
    const d = this.peek(1)
    const e = this.peek(2)
    if ((c === 'e' || c === 'E') && ((d === '+' || d === '-') ? isDigit(e) : isDigit(d))) {
      isInt = false
      repr += this.advanceChar()
      if (this.peek() === '+' || this.peek() === '-') repr += this.advanceChar()
      while (isDigit(this.peek())) repr += this.advanceChar()
    }
    return { repr, value: Number(repr), numberType: isInt ? 'integer' : 'number' }
  }

  private consumeName(): string {
    let value = ''
    while (true) {
      const char = this.peek()
      if (isNameChar(char)) {
        value += this.advanceChar()
        continue
      }
      if (isValidEscape(char, this.peek(1))) {
        this.advanceChar()
        value += this.consumeEscapedCodePoint()
        continue
      }
      break
    }
    return value
  }

  private consumeEscapedCodePoint(): string {
    let hex = ''
    let count = 0
    while (count < 6 && isHexDigit(this.peek())) {
      hex += this.advanceChar()
      count += 1
    }
    if (hex) {
      if (isWhitespace(this.peek())) this.advanceChar()
      const codePoint = Number.parseInt(hex, 16)
      if (!Number.isFinite(codePoint) || codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return '\uFFFD'
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return '\uFFFD'
      }
    }
    const char = this.peek()
    if (!char) return '\uFFFD'
    return this.advanceChar()
  }

  private isUnicodeRangeStart(): boolean {
    const c0 = this.peek()
    const c1 = this.peek(1)
    const c2 = this.peek(2)
    if (c0 !== 'u' && c0 !== 'U') return false
    if (c1 !== '+') return false
    return isHexDigit(c2) || c2 === '?'
  }

  private wouldStartNumber(): boolean {
    const c0 = this.peek()
    const c1 = this.peek(1)
    const c2 = this.peek(2)
    if (c0 === '+' || c0 === '-') {
      if (isDigit(c1)) return true
      return c1 === '.' && isDigit(c2)
    }
    if (c0 === '.') return isDigit(c1)
    return isDigit(c0)
  }

  private wouldStartIdent(): boolean {
    return this.wouldStartIdentAt(0)
  }

  private wouldStartIdentAt(offset: number): boolean {
    const c0 = this.peek(offset)
    const c1 = this.peek(offset + 1)
    const c2 = this.peek(offset + 2)
    if (c0 === '-') {
      if (isNameStart(c1) || c1 === '-' || isValidEscape(c1, c2)) return true
      return false
    }
    if (isNameStart(c0)) return true
    if (c0 === '\\') return isValidEscape(c0, c1)
    return false
  }

  private wouldStartNameAt(offset: number): boolean {
    const c0 = this.peek(offset)
    const c1 = this.peek(offset + 1)
    if (isNameChar(c0)) return true
    return isValidEscape(c0, c1)
  }

  private wouldStartIdentFrom(value: string): boolean {
    if (!value) return false
    const c0 = value[0] ?? ''
    const c1 = value[1] ?? ''
    const c2 = value[2] ?? ''
    if (c0 === '-') return isNameStart(c1) || c1 === '-' || isValidEscape(c1, c2)
    if (isNameStart(c0)) return true
    if (c0 === '\\') return isValidEscape(c0, c1)
    return false
  }

  private consumeSimpleToken(): boolean {
    const char = this.peek()
    const start = this.point()
    const type =
      char === ':' ? 'colon'
      : char === ';' ? 'semicolon'
      : char === ',' ? 'comma'
      : char === '(' ? 'parenOpen'
      : char === ')' ? 'parenClose'
      : char === '[' ? 'squareOpen'
      : char === ']' ? 'squareClose'
      : char === '{' ? 'braceOpen'
      : char === '}' ? 'braceClose'
      : undefined

    if (!type) return false
    this.advanceChar()
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type, text, span: createSpan(start, end) } as CssToken)
    return true
  }

  private consumeMatchOperator(): boolean {
    const start = this.point()
    const c0 = this.peek()
    const c1 = this.peek(1)
    const c2 = this.peek(2)
    const tokenType =
      c0 === '~' && c1 === '=' ? 'includeMatch'
      : c0 === '|' && c1 === '=' ? 'dashMatch'
      : c0 === '^' && c1 === '=' ? 'prefixMatch'
      : c0 === '$' && c1 === '=' ? 'suffixMatch'
      : c0 === '*' && c1 === '=' ? 'substringMatch'
      : c0 === '|' && c1 === '|' && c2 === '=' ? 'column'
      : undefined
    if (!tokenType) return false
    const length = tokenType === 'column' ? 3 : 2
    for (let i = 0; i < length; i += 1) this.advanceChar()
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: tokenType, text, span: createSpan(start, end) } as CssToken)
    return true
  }

  private consumeDelimToken(): void {
    const start = this.point()
    const value = this.advanceChar()
    const end = this.point()
    const text = this.input.slice(start.offset, end.offset)
    this.tokens.push({ type: 'delim', text, span: createSpan(start, end), value })
  }
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f'
}

function isNewline(char: string): boolean {
  return char === '\n' || char === '\r' || char === '\f'
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

function isHexDigit(char: string): boolean {
  return (char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')
}

function isNameStart(char: string): boolean {
  if (!char) return false
  return isAsciiLetter(char) || isNonAscii(char) || char === '_'
}

function isNameChar(char: string): boolean {
  if (!char) return false
  return isNameStart(char) || isDigit(char) || char === '-'
}

function isAsciiLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

function isNonAscii(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code >= 0x80
}

function isNonPrintable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return (code >= 0 && code <= 8) || code === 0x0b || (code >= 0x0e && code <= 0x1f) || code === 0x7f
}

function isValidEscape(c0: string, c1: string): boolean {
  if (c0 !== '\\') return false
  if (!c1) return false
  return !isNewline(c1)
}
