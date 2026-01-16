import type { Diagnostic, SourcePoint } from '../../../syntax/diagnostic'
import { createPoint, createSpan } from '../../shared/source'
import type { HtmlLsToken } from './token'

type State =
  | 'Data'
  | 'TagOpen'
  | 'EndTagOpen'
  | 'TagName'
  | 'BeforeAttrName'
  | 'AttrName'
  | 'AfterAttrName'
  | 'BeforeAttrValue'
  | 'AttrValueDoubleQuoted'
  | 'AttrValueSingleQuoted'
  | 'AttrValueUnquoted'
  | 'AfterAttrValueQuoted'
  | 'SelfClosingStartTag'
  | 'MarkupDeclarationOpen'
  | 'Comment'
  | 'Doctype'
  | 'RawText'

export interface HtmlLsTokenizeResult {
  tokens: HtmlLsToken[]
  diagnostics: Diagnostic[]
}

export class HtmlLsTokenizer {
  private readonly input: string
  private readonly tokens: HtmlLsToken[] = []
  private readonly diagnostics: Diagnostic[] = []

  private index = 0
  private line = 1
  private column = 1

  private state: State = 'Data'
  private rawTextTagName: string | undefined

  private currentTag:
    | { kind: 'StartTag'; tagName: string; attrs: Record<string, string | true>; selfClosing: boolean; start: SourcePoint; attrName?: string; attrValue?: string; attrQuote?: '"' | "'" | undefined }
    | { kind: 'EndTag'; tagName: string; start: SourcePoint }
    | undefined

  private commentBuffer = ''
  private commentStart: SourcePoint | undefined
  private doctypeBuffer = ''
  private doctypeStart: SourcePoint | undefined

  constructor(input: string) {
    this.input = input
  }

  tokenize(): HtmlLsTokenizeResult {
    let dataBuffer = ''
    let dataStart: SourcePoint | undefined

    const flushChars = () => {
      if (!dataBuffer || !dataStart) return
      const end = this.point()
      this.tokens.push({ type: 'Character', data: dataBuffer, span: createSpan(dataStart, end) })
      dataBuffer = ''
      dataStart = undefined
    }

    while (this.index < this.input.length) {
      const char = this.peek()

      if (this.state === 'RawText') {
        const tagName = this.rawTextTagName
        if (tagName && this.startsWith(`</${tagName}`)) {
          flushChars()
          this.state = 'TagOpen'
          continue
        }
        if (!dataStart) dataStart = this.point()
        dataBuffer += this.advanceChar()
        continue
      }

      switch (this.state) {
        case 'Data': {
          if (char === '<') {
            flushChars()
            this.state = 'TagOpen'
            this.advanceChar()
            break
          }
          if (!dataStart) dataStart = this.point()
          dataBuffer += this.advanceChar()
          break
        }
        case 'TagOpen': {
          if (char === '!') {
            this.state = 'MarkupDeclarationOpen'
            this.advanceChar()
            break
          }
          if (char === '/') {
            this.state = 'EndTagOpen'
            this.advanceChar()
            break
          }
          if (isAsciiAlpha(char)) {
            this.currentTag = { kind: 'StartTag', tagName: '', attrs: {}, selfClosing: false, start: this.point() }
            this.state = 'TagName'
            break
          }
          dataStart = dataStart ?? this.point()
          dataBuffer += '<'
          this.state = 'Data'
          break
        }
        case 'EndTagOpen': {
          if (!isAsciiAlpha(char)) {
            this.diagnostics.push({ level: 'error', code: 'html', message: 'Invalid end tag', span: createSpan(this.point(), this.point()) })
            dataStart = dataStart ?? this.point()
            dataBuffer += '</'
            this.state = 'Data'
            break
          }
          this.currentTag = { kind: 'EndTag', tagName: '', start: this.point() }
          this.state = 'TagName'
          break
        }
        case 'MarkupDeclarationOpen': {
          if (this.startsWith('--')) {
            this.commentStart = this.point()
            this.commentBuffer = ''
            this.advanceChar()
            this.advanceChar()
            this.state = 'Comment'
            break
          }
          if (this.startsWithIgnoreCase('DOCTYPE')) {
            this.doctypeStart = this.point()
            this.doctypeBuffer = ''
            for (let i = 0; i < 7; i += 1) this.advanceChar()
            this.state = 'Doctype'
            break
          }
          this.commentStart = this.point()
          this.commentBuffer = ''
          this.state = 'Comment'
          break
        }
        case 'Comment': {
          if (this.startsWith('-->')) {
            const start = this.commentStart ?? this.point()
            this.advanceChar()
            this.advanceChar()
            this.advanceChar()
            const end = this.point()
            this.tokens.push({ type: 'Comment', data: this.commentBuffer, span: createSpan(start, end) })
            this.commentBuffer = ''
            this.commentStart = undefined
            this.state = 'Data'
            break
          }
          this.commentBuffer += this.advanceChar()
          break
        }
        case 'Doctype': {
          if (char === '>') {
            const start = this.doctypeStart ?? this.point()
            this.advanceChar()
            const end = this.point()
            const name = this.doctypeBuffer.trim().split(/\s+/)[0] ?? ''
            this.tokens.push({ type: 'Doctype', name, forceQuirks: false, span: createSpan(start, end) })
            this.doctypeBuffer = ''
            this.doctypeStart = undefined
            this.state = 'Data'
            break
          }
          this.doctypeBuffer += this.advanceChar()
          break
        }
        case 'TagName': {
          const tag = this.currentTag
          if (!tag) {
            this.state = 'Data'
            break
          }
          if (isWhitespace(char)) {
            this.advanceChar()
            if (tag.kind === 'StartTag') this.state = 'BeforeAttrName'
            else this.state = 'AfterAttrName'
            break
          }
          if (char === '/') {
            this.advanceChar()
            this.state = 'SelfClosingStartTag'
            break
          }
          if (char === '>') {
            this.advanceChar()
            this.emitTag(tag)
            if (tag.kind === 'StartTag' && isRawTextTag(tag.tagName)) {
              this.rawTextTagName = tag.tagName
              this.state = 'RawText'
            } else {
              this.state = 'Data'
            }
            this.currentTag = undefined
            break
          }
          const lower = asciiLower(char)
          tag.tagName += lower
          this.advanceChar()
          break
        }
        case 'BeforeAttrName': {
          if (isWhitespace(char)) {
            this.advanceChar()
            break
          }
          if (char === '/') {
            this.advanceChar()
            this.state = 'SelfClosingStartTag'
            break
          }
          if (char === '>') {
            this.advanceChar()
            if (this.currentTag) this.emitTag(this.currentTag)
            this.currentTag = undefined
            this.state = 'Data'
            break
          }
          if (this.currentTag?.kind === 'StartTag') {
            this.currentTag.attrName = ''
            this.currentTag.attrValue = ''
            this.currentTag.attrQuote = undefined
            this.state = 'AttrName'
            break
          }
          this.state = 'AfterAttrName'
          break
        }
        case 'AttrName': {
          const tag = this.currentTag
          if (!tag || tag.kind !== 'StartTag') {
            this.state = 'Data'
            break
          }
          if (isWhitespace(char)) {
            this.commitAttr(tag)
            this.advanceChar()
            this.state = 'AfterAttrName'
            break
          }
          if (char === '=') {
            this.advanceChar()
            this.state = 'BeforeAttrValue'
            break
          }
          if (char === '/' || char === '>') {
            this.commitAttr(tag)
            this.state = 'AfterAttrName'
            break
          }
          tag.attrName = (tag.attrName ?? '') + asciiLower(char)
          this.advanceChar()
          break
        }
        case 'AfterAttrName': {
          if (isWhitespace(char)) {
            this.advanceChar()
            break
          }
          if (char === '=') {
            this.advanceChar()
            this.state = 'BeforeAttrValue'
            break
          }
          if (char === '/') {
            this.advanceChar()
            this.state = 'SelfClosingStartTag'
            break
          }
          if (char === '>') {
            this.advanceChar()
            if (this.currentTag) this.emitTag(this.currentTag)
            this.currentTag = undefined
            this.state = 'Data'
            break
          }
          if (this.currentTag?.kind === 'StartTag') {
            this.currentTag.attrName = ''
            this.currentTag.attrValue = ''
            this.currentTag.attrQuote = undefined
            this.state = 'AttrName'
            break
          }
          this.advanceChar()
          break
        }
        case 'BeforeAttrValue': {
          const tag = this.currentTag
          if (!tag || tag.kind !== 'StartTag') {
            this.state = 'Data'
            break
          }
          if (isWhitespace(char)) {
            this.advanceChar()
            break
          }
          if (char === '"') {
            tag.attrQuote = '"'
            tag.attrValue = ''
            this.advanceChar()
            this.state = 'AttrValueDoubleQuoted'
            break
          }
          if (char === "'") {
            tag.attrQuote = "'"
            tag.attrValue = ''
            this.advanceChar()
            this.state = 'AttrValueSingleQuoted'
            break
          }
          tag.attrQuote = undefined
          tag.attrValue = ''
          this.state = 'AttrValueUnquoted'
          break
        }
        case 'AttrValueDoubleQuoted': {
          const tag = this.currentTag
          if (!tag || tag.kind !== 'StartTag') {
            this.state = 'Data'
            break
          }
          if (char === '"') {
            this.advanceChar()
            this.commitAttr(tag)
            this.state = 'AfterAttrValueQuoted'
            break
          }
          tag.attrValue = (tag.attrValue ?? '') + this.advanceChar()
          break
        }
        case 'AttrValueSingleQuoted': {
          const tag = this.currentTag
          if (!tag || tag.kind !== 'StartTag') {
            this.state = 'Data'
            break
          }
          if (char === "'") {
            this.advanceChar()
            this.commitAttr(tag)
            this.state = 'AfterAttrValueQuoted'
            break
          }
          tag.attrValue = (tag.attrValue ?? '') + this.advanceChar()
          break
        }
        case 'AttrValueUnquoted': {
          const tag = this.currentTag
          if (!tag || tag.kind !== 'StartTag') {
            this.state = 'Data'
            break
          }
          if (isWhitespace(char)) {
            this.commitAttr(tag)
            this.advanceChar()
            this.state = 'BeforeAttrName'
            break
          }
          if (char === '>') {
            this.commitAttr(tag)
            this.advanceChar()
            this.emitTag(tag)
            this.currentTag = undefined
            this.state = 'Data'
            break
          }
          tag.attrValue = (tag.attrValue ?? '') + this.advanceChar()
          break
        }
        case 'AfterAttrValueQuoted': {
          if (isWhitespace(char)) {
            this.advanceChar()
            this.state = 'BeforeAttrName'
            break
          }
          if (char === '/') {
            this.advanceChar()
            this.state = 'SelfClosingStartTag'
            break
          }
          if (char === '>') {
            this.advanceChar()
            if (this.currentTag) this.emitTag(this.currentTag)
            this.currentTag = undefined
            this.state = 'Data'
            break
          }
          this.state = 'BeforeAttrName'
          break
        }
        case 'SelfClosingStartTag': {
          const tag = this.currentTag
          if (char === '>') {
            this.advanceChar()
            if (tag && tag.kind === 'StartTag') {
              tag.selfClosing = true
              this.emitTag(tag)
              this.currentTag = undefined
              this.state = 'Data'
              break
            }
          }
          this.state = 'BeforeAttrName'
          break
        }
      }
    }

    flushChars()
    const eofPoint = this.point()
    this.tokens.push({ type: 'EOF', span: createSpan(eofPoint, eofPoint) })
    return { tokens: this.tokens, diagnostics: this.diagnostics }
  }

  private commitAttr(tag: Extract<NonNullable<HtmlLsTokenizer['currentTag']>, { kind: 'StartTag' }>): void {
    const name = (tag.attrName ?? '').trim()
    if (!name) return
    const value = tag.attrValue ?? ''
    tag.attrs[name] = tag.attrQuote ? value : (value ? value : true)
    tag.attrName = undefined
    tag.attrValue = undefined
    tag.attrQuote = undefined
  }

  private emitTag(tag: NonNullable<HtmlLsTokenizer['currentTag']>): void {
    const start = tag.start
    const end = this.point()
    if (tag.kind === 'StartTag') {
      this.commitAttr(tag)
      this.tokens.push({
        type: 'StartTag',
        tagName: tag.tagName,
        attrs: tag.attrs,
        selfClosing: tag.selfClosing,
        span: createSpan(start, end),
      })
    } else {
      this.tokens.push({ type: 'EndTag', tagName: tag.tagName, span: createSpan(start, end) })
    }
  }

  private peek(offset = 0): string {
    return this.input[this.index + offset] ?? ''
  }

  private startsWith(value: string): boolean {
    return this.input.startsWith(value, this.index)
  }

  private startsWithIgnoreCase(value: string): boolean {
    return this.input.slice(this.index, this.index + value.length).toLowerCase() === value.toLowerCase()
  }

  private point(): SourcePoint {
    return createPoint(this.line, this.column, this.index)
  }

  private advanceChar(): string {
    const char = this.input[this.index] ?? ''
    this.index += 1
    if (char === '\n') {
      this.line += 1
      this.column = 1
      return char
    }
    this.column += 1
    return char
  }
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f'
}

function isAsciiAlpha(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

function asciiLower(char: string): string {
  const code = char.charCodeAt(0)
  if (code >= 65 && code <= 90) return String.fromCharCode(code + 32)
  return char
}

function isRawTextTag(tagName: string): boolean {
  return tagName === 'script' || tagName === 'style' || tagName === 'title' || tagName === 'textarea'
}
