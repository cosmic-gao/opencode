import type { Diagnostic, SourcePoint, SourceSpan } from '../syntax/diagnostic'

export type TokenCategory = 'identifier' | 'literal' | 'operator' | 'delimiter' | 'lineBreak' | 'end' | 'unknown'

export type TokenKind = string

export interface Token {
  category: TokenCategory
  kind?: TokenKind
  text: string
  value?: unknown
  span: SourceSpan
}

export interface TokenizeResult {
  tokens: Token[]
  diagnostics: Diagnostic[]
}

export interface LanguageProfile {
  name: string
  whitespace?: { chars: string[] }
  lineBreak?: { chars: string[] }
  comments?: { line?: Array<{ start: string }>; block?: Array<{ start: string; end: string }> }
  delimiters?: Array<{ text: string; kind: TokenKind }>
  operators?: Array<{ text: string; kind: TokenKind }>
  literals?: {
    string?: Array<{ quote: string; escapes?: Record<string, string> }>
    number?: {
      allowFloat?: boolean
      allowExponent?: boolean
      allowSeparator?: boolean
      allowHex?: boolean
      allowBinary?: boolean
      allowOctal?: boolean
    }
  }
  identifier?: {
    isStart(char: string): boolean
    isPart(char: string): boolean
  }
  unknown?: { emitToken?: boolean }
}

function createDefaultEscapes(quote: string): Record<string, string> {
  return { n: '\n', t: '\t', r: '\r', [quote]: quote, '\\': '\\' }
}

export const ParseoDslProfile: LanguageProfile = {
  name: 'parseo-dsl',
  whitespace: { chars: [' ', '\t', '\r'] },
  lineBreak: { chars: ['\n'] },
  comments: { line: [{ start: '#' }, { start: '//' }], block: [{ start: '/*', end: '*/' }] },
  delimiters: [
    { text: '{', kind: 'braceOpen' },
    { text: '}', kind: 'braceClose' },
    { text: '=', kind: 'equals' },
  ],
  operators: [{ text: '->', kind: 'arrow' }],
  literals: {
    string: [
      { quote: '"', escapes: createDefaultEscapes('"') },
      { quote: "'", escapes: createDefaultEscapes("'") },
    ],
    number: {
      allowFloat: true,
      allowExponent: true,
      allowSeparator: true,
      allowHex: true,
      allowBinary: true,
      allowOctal: true,
    },
  },
  identifier: {
    isStart: (char) => /[A-Za-z_]/.test(char),
    isPart: (char) => /[A-Za-z0-9_-]/.test(char),
  },
  unknown: { emitToken: true },
}

type NumberRule = {
  allowFloat: boolean
  allowExponent: boolean
  allowSeparator: boolean
  allowHex: boolean
  allowBinary: boolean
  allowOctal: boolean
}

class ProfileLexer {
  private readonly text: string
  private readonly profile: LanguageProfile
  private readonly diagnostics: Diagnostic[] = []
  private readonly tokens: Token[] = []
  private readonly whitespaceSet: Set<string>
  private readonly lineBreakSet: Set<string>
  private readonly delimiterList: Array<{ text: string; kind: TokenKind }>
  private readonly operatorList: Array<{ text: string; kind: TokenKind }>
  private readonly stringRuleList: Array<{ quote: string; escapes: Record<string, string> }>
  private readonly numberRule: NumberRule

  private index = 0
  private line = 1
  private column = 1

  constructor(text: string, profile: LanguageProfile) {
    this.text = text
    this.profile = profile
    this.whitespaceSet = new Set(profile.whitespace?.chars ?? [])
    this.lineBreakSet = new Set(profile.lineBreak?.chars ?? ['\n'])
    this.delimiterList = [...(profile.delimiters ?? [])].sort((a, b) => b.text.length - a.text.length)
    this.operatorList = [...(profile.operators ?? [])].sort((a, b) => b.text.length - a.text.length)
    this.stringRuleList = (profile.literals?.string ?? []).map((rule) => ({
      quote: rule.quote,
      escapes: rule.escapes ?? createDefaultEscapes(rule.quote),
    }))
    this.numberRule = {
      allowFloat: profile.literals?.number?.allowFloat ?? false,
      allowExponent: profile.literals?.number?.allowExponent ?? false,
      allowSeparator: profile.literals?.number?.allowSeparator ?? false,
      allowHex: profile.literals?.number?.allowHex ?? false,
      allowBinary: profile.literals?.number?.allowBinary ?? false,
      allowOctal: profile.literals?.number?.allowOctal ?? false,
    }
  }

  tokenize(): TokenizeResult {
    while (this.index < this.text.length) {
      if (this.skipWhitespace()) continue
      if (this.readLineBreak()) continue
      if (this.skipLineComment()) continue
      if (this.skipBlockComment()) continue

      const hasToken =
        this.readOperator() ||
        this.readDelimiter() ||
        this.readStringLiteral() ||
        this.readNumberLiteral() ||
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
    if (this.lineBreakSet.has(char)) {
      this.line += 1
      this.column = 1
      return char
    }
    this.column += 1
    return char
  }

  private addToken(
    category: TokenCategory,
    tokenText: string,
    start: SourcePoint,
    end: SourcePoint,
    kind?: TokenKind,
    value?: unknown,
  ): void {
    this.tokens.push({ category, kind, text: tokenText, value, span: createSpan(start, end) })
  }

  private addError(message: string, span?: SourceSpan): void {
    this.diagnostics.push({ level: 'error', code: 'tokenize', message, span })
  }

  private skipWhitespace(): boolean {
    const char = this.currentChar()
    if (!this.whitespaceSet.has(char)) return false
    this.advanceChar()
    return true
  }

  private readLineBreak(): boolean {
    const char = this.currentChar()
    if (!this.lineBreakSet.has(char)) return false
    const start = this.point()
    this.advanceChar()
    const end = this.point()
    this.addToken('lineBreak', char, start, end, 'newline')
    return true
  }

  private skipLineComment(): boolean {
    const commentRules = this.profile.comments?.line ?? []
    for (const rule of commentRules) {
      if (!this.startsWith(rule.start)) continue
      this.advanceText(rule.start)
      while (this.index < this.text.length && !this.lineBreakSet.has(this.currentChar())) this.advanceChar()
      return true
    }
    return false
  }

  private skipBlockComment(): boolean {
    const commentRules = this.profile.comments?.block ?? []
    for (const rule of commentRules) {
      if (!this.startsWith(rule.start)) continue
      const start = this.point()
      this.advanceText(rule.start)
      while (this.index < this.text.length && !this.startsWith(rule.end)) this.advanceChar()
      if (this.startsWith(rule.end)) this.advanceText(rule.end)
      else this.addError('Unclosed block comment', createSpan(start, this.point()))
      return true
    }
    return false
  }

  private readDelimiter(): boolean {
    for (const rule of this.delimiterList) {
      if (!this.startsWith(rule.text)) continue
      const start = this.point()
      this.advanceText(rule.text)
      const end = this.point()
      this.addToken('delimiter', rule.text, start, end, rule.kind)
      return true
    }
    return false
  }

  private readOperator(): boolean {
    for (const rule of this.operatorList) {
      if (!this.startsWith(rule.text)) continue
      const start = this.point()
      this.advanceText(rule.text)
      const end = this.point()
      this.addToken('operator', rule.text, start, end, rule.kind)
      return true
    }
    return false
  }

  private readStringLiteral(): boolean {
    const quote = this.currentChar()
    const rule = this.stringRuleList.find((r) => r.quote === quote)
    if (!rule) return false

    const start = this.point()
    this.advanceChar()

    let value = ''
    while (this.index < this.text.length && this.currentChar() !== rule.quote) {
      if (this.currentChar() === '\\') {
        this.advanceChar()
        value += this.readEscape(rule.escapes)
        continue
      }
      value += this.advanceChar()
    }

    if (this.currentChar() === rule.quote) this.advanceChar()
    else this.addError('Unclosed string literal', createSpan(start, this.point()))

    const end = this.point()
    this.addToken('literal', value, start, end, 'string', value)
    return true
  }

  private readEscape(escapes: Record<string, string>): string {
    const escaped = this.currentChar()
    if (!escaped) return ''
    this.advanceChar()
    return escapes[escaped] ?? escaped
  }

  private readNumberLiteral(): boolean {
    const char = this.currentChar()
    if (!isDigit(char)) return false

    const start = this.point()
    const startOffset = start.offset
    const base = this.tryReadNumberPrefix()
    if (base !== 10) {
      this.readDigitsWithSeparator(base)
    } else {
      this.readDigitsWithSeparator(10)
      if (this.numberRule.allowFloat && this.currentChar() === '.' && isDigit(this.nextChar())) {
        this.advanceChar()
        this.readDigitsWithSeparator(10)
      }
      if (this.numberRule.allowExponent) this.readExponentPart()
    }
    const end = this.point()
    const raw = this.text.slice(startOffset, end.offset)
    const parsed = this.parseNumberValue(raw, base)
    this.addToken('literal', raw, start, end, 'number', parsed)
    return true
  }

  private tryReadNumberPrefix(): number {
    if (this.currentChar() !== '0') return 10
    const next = this.nextChar()
    if ((next === 'x' || next === 'X') && this.numberRule.allowHex) {
      this.advanceChar()
      this.advanceChar()
      return 16
    }
    if ((next === 'b' || next === 'B') && this.numberRule.allowBinary) {
      this.advanceChar()
      this.advanceChar()
      return 2
    }
    if ((next === 'o' || next === 'O') && this.numberRule.allowOctal) {
      this.advanceChar()
      this.advanceChar()
      return 8
    }
    return 10
  }

  private readDigitsWithSeparator(base: number): void {
    let hasDigit = false
    let previousSeparator = false
    while (this.index < this.text.length) {
      const char = this.currentChar()
      if (this.numberRule.allowSeparator && char === '_') {
        if (!hasDigit || previousSeparator) break
        previousSeparator = true
        this.advanceChar()
        continue
      }
      if (!isDigitInBase(char, base)) break
      hasDigit = true
      previousSeparator = false
      this.advanceChar()
    }
  }

  private readExponentPart(): void {
    const char = this.currentChar()
    if (char !== 'e' && char !== 'E') return
    const next = this.nextChar()
    const nextNext = this.nextChar(2)
    const hasSign = next === '+' || next === '-'
    const digitAfter = hasSign ? nextNext : next
    if (!isDigit(digitAfter)) return
    this.advanceChar()
    if (hasSign) this.advanceChar()
    while (isDigit(this.currentChar()) || (this.numberRule.allowSeparator && this.currentChar() === '_')) {
      this.advanceChar()
    }
  }

  private parseNumberValue(raw: string, base: number): number {
    const normalized = this.numberRule.allowSeparator ? raw.replaceAll('_', '') : raw
    if (base === 10) return Number(normalized)
    const noPrefix = normalized.replace(/^0[xX]|^0[bB]|^0[oO]/, '')
    return Number.parseInt(noPrefix, base)
  }

  private readIdentifier(): boolean {
    const identifier = this.profile.identifier
    if (!identifier) return false
    const char = this.currentChar()
    if (!identifier.isStart(char)) return false

    const start = this.point()
    let value = ''
    while (this.index < this.text.length && identifier.isPart(this.currentChar())) value += this.advanceChar()
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
    const emitToken = this.profile.unknown?.emitToken ?? true
    if (emitToken) this.addToken('unknown', char, start, end)
  }

  private startsWith(value: string): boolean {
    return this.text.startsWith(value, this.index)
  }

  private advanceText(value: string): void {
    for (let i = 0; i < value.length; i += 1) this.advanceChar()
  }
}

function createPoint(line: number, column: number, offset: number): SourcePoint {
  return { line, column, offset }
}

function createSpan(start: SourcePoint, end: SourcePoint): SourceSpan {
  return { start, end }
}

function isDigit(char: string): boolean {
  return /[0-9]/.test(char)
}

function isDigitInBase(char: string, base: number): boolean {
  if (base === 2) return char === '0' || char === '1'
  if (base === 8) return /[0-7]/.test(char)
  if (base === 10) return /[0-9]/.test(char)
  if (base === 16) return /[0-9a-fA-F]/.test(char)
  return false
}

export function tokenizeText(text: string, profile: LanguageProfile = ParseoDslProfile): TokenizeResult {
  return new ProfileLexer(text, profile).tokenize()
}
