import type { Diagnostic, SourceSpan } from '../syntax/diagnostic'
import type { MetaValue, SwcSpan, SyntaxNode } from '../syntax/node'
import type { LanguageProfile, Token } from './tokenizer'
import { ParseoDslProfile, tokenizeText } from './tokenizer'

export interface ParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

function isEndToken(token: Token): boolean {
  return token.category === 'end'
}

function mergeSpan(start?: SourceSpan, end?: SourceSpan): SourceSpan | undefined {
  if (!start) return end
  if (!end) return start
  return { start: start.start, end: end.end }
}

function toSwcSpan(span?: SourceSpan): SwcSpan | undefined {
  if (!span) return
  return { start: span.start.offset, end: span.end.offset, ctxt: 0 }
}

function toValue(token: Token): MetaValue {
  if (token.category === 'literal' && token.kind === 'string' && typeof token.value === 'string') return token.value
  if (token.category === 'literal' && token.kind === 'number' && typeof token.value === 'number') return token.value
  if (token.category === 'literal' && token.kind === 'string') return token.text
  if (token.category === 'literal' && token.kind === 'number') return Number(token.text)
  if (token.category === 'identifier') {
    if (token.text === 'true') return true
    if (token.text === 'false') return false
    if (token.text === 'null') return null
    return token.text
  }
  return token.text
}

export class TextParser {
  private readonly tokens: Token[]
  private readonly diagnostics: Diagnostic[]
  private index = 0

  /**
   * 创建 DSL 文本解析器实例。
   *
   * @param text - DSL 源文本
   */
  constructor(text: string, profile: LanguageProfile = ParseoDslProfile) {
    const result = tokenizeText(text, profile)
    this.tokens = result.tokens
    this.diagnostics = [...result.diagnostics]
  }

  /**
   * 解析整个文档并产出语法节点列表。
   *
   * @returns 解析结果（包含节点与诊断信息）
   */
  parse(): ParseResult {
    const nodes: SyntaxNode[] = []
    while (!isEndToken(this.peek())) {
      this.skipNewline()
      if (isEndToken(this.peek())) break
      if (this.peek().category === 'delimiter' && this.peek().kind === 'braceClose') {
        this.error('Unexpected closing brace', this.peek().span)
        this.index += 1
        continue
      }
      const node = this.parseNode()
      if (node) nodes.push(node)
      this.skipNewline()
    }
    return { nodes, diagnostics: this.diagnostics }
  }

  private parseNode(): SyntaxNode | undefined {
    const kindToken = this.consume('identifier')
    if (!kindToken) return this.recoverInvalidNode()

    const type = kindToken.text
    const startSpan = kindToken.span
    const startIndex = this.index

    const linkNode = this.parseLinkNode(type, startSpan)
    if (linkNode) return linkNode

    return this.parseBlockOrStatement(type, startSpan, startIndex)
  }

  private recoverInvalidNode(): undefined {
    this.recoverLine()
    return
  }

  private parseLinkNode(type: string, typeSpan: SourceSpan): SyntaxNode | undefined {
    const fromToken = this.peek()
    const arrowToken = this.peek(1)
    if (fromToken.category !== 'identifier' || arrowToken.category !== 'operator' || arrowToken.kind !== 'arrow') return

    this.consume('identifier')
    this.consume('operator', 'arrow')
    const toToken = this.consume('identifier')
    const attrs = this.parseAttrs()

    const endSpan = (toToken?.span ?? fromToken.span)
    const loc = mergeSpan(typeSpan, endSpan)
    this.recoverLine()

    if (!toToken) return { type, attrs: { from: fromToken.text, ...attrs }, span: toSwcSpan(loc), loc }
    return { type, attrs: { from: fromToken.text, to: toToken.text, ...attrs }, span: toSwcSpan(loc), loc }
  }

  private parseBlockOrStatement(type: string, typeSpan: SourceSpan, startIndex: number): SyntaxNode {
    const name = this.parseName()
    const attrs = this.parseAttrs()
    if (this.peek().category === 'delimiter' && this.peek().kind === 'braceOpen') return this.parseBlock(type, name, attrs, typeSpan)

    const loc = mergeSpan(typeSpan, this.previous(startIndex)?.span ?? typeSpan)
    this.recoverLine()
    return { type, name, attrs, span: toSwcSpan(loc), loc }
  }

  private parseName(): string | undefined {
    if (this.peek().category !== 'identifier') return
    return this.consume('identifier')?.text
  }

  private parseBlock(
    type: string,
    name: string | undefined,
    attrs: Record<string, MetaValue> | undefined,
    startSpan: SourceSpan,
  ): SyntaxNode {
    const open = this.consume('delimiter', 'braceOpen')!
    const children = this.parseChildren()
    const close = this.consume('delimiter', 'braceClose')
    if (!close) this.error('Missing closing brace', open.span)

    const loc = mergeSpan(startSpan, close?.span ?? open.span)
    this.recoverLine()
    return { type, name, attrs, children, span: toSwcSpan(loc), loc }
  }

  private parseChildren(): SyntaxNode[] {
    const children: SyntaxNode[] = []
    while (!isEndToken(this.peek()) && !(this.peek().category === 'delimiter' && this.peek().kind === 'braceClose')) {
      this.skipNewline()
      if (this.peek().category === 'delimiter' && this.peek().kind === 'braceClose') break
      const child = this.parseNode()
      if (child) children.push(child)
      this.skipNewline()
    }
    return children
  }

  private parseAttrs(): Record<string, MetaValue> | undefined {
    const attrs: Record<string, MetaValue> = {}
    let hasAny = false

    while (true) {
      const keyToken = this.peek()
      const equalsToken = this.peek(1)
      if (keyToken.category !== 'identifier' || equalsToken.category !== 'delimiter' || equalsToken.kind !== 'equals') break

      this.index += 1
      this.index += 1

      const valueToken = this.peek()
      const isIdentifier = valueToken.category === 'identifier'
      const isLiteral = valueToken.category === 'literal' && (valueToken.kind === 'number' || valueToken.kind === 'string')
      if (!isIdentifier && !isLiteral) {
        this.error('Missing attribute value', valueToken.span)
        break
      }
      this.index += 1

      attrs[keyToken.text] = toValue(valueToken)
      hasAny = true
    }

    if (!hasAny) return
    return attrs
  }

  private peek(offset = 0): Token {
    const nextIndex = this.index + offset
    if (nextIndex < 0) return this.tokens[0]!
    return this.tokens[nextIndex] ?? this.tokens[this.tokens.length - 1]!
  }

  private previous(fallbackIndex: number): Token | undefined {
    const previousIndex = Math.max(this.index - 1, fallbackIndex - 1, 0)
    return this.tokens[previousIndex]
  }

  private consume(category: Token['category'], kind?: Token['kind']): Token | undefined {
    const token = this.peek()
    const categoryMatch = token.category === category
    const kindMatch = kind === undefined ? true : token.kind === kind
    if (!categoryMatch || !kindMatch) {
      const expected = kind ? `${category}:${kind}` : category
      const actual = token.kind ? `${token.category}:${token.kind}` : token.category
      this.error(`Expected ${expected} but got ${actual}`, token.span)
      return
    }
    this.index += 1
    return token
  }

  private skipNewline(): void {
    while (this.peek().category === 'lineBreak') this.index += 1
  }

  private recoverLine(): void {
    while (
      !isEndToken(this.peek()) &&
      this.peek().category !== 'lineBreak' &&
      !(this.peek().category === 'delimiter' && this.peek().kind === 'braceClose')
    ) {
      this.index += 1
    }
  }

  private error(message: string, span?: SourceSpan): void {
    this.diagnostics.push({ level: 'error', code: 'parse', message, span })
  }
}

/**
 * 解析 DSL 文本为语法节点，并输出诊断信息。
 *
 * @param text - DSL 源文本
 * @returns 解析结果（不抛异常）
 */
export function parseText(text: string, profile: LanguageProfile = ParseoDslProfile): ParseResult {
  return new TextParser(text, profile).parse()
}
