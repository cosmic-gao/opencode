import type { Diagnostic, SourceSpan } from '../syntax/diagnostic'
import type { MetaValue, SyntaxNode } from '../syntax/node'
import type { Token } from './tokenizer'
import { tokenizeText } from './tokenizer'

export interface ParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

function isEndToken(token: Token): boolean {
  return token.type === 'end'
}

function mergeSpan(start?: SourceSpan, end?: SourceSpan): SourceSpan | undefined {
  if (!start) return end
  if (!end) return start
  return { start: start.start, end: end.end }
}

function toValue(token: Token): MetaValue {
  if (token.type === 'string') return token.text
  if (token.type === 'number') return Number(token.text)
  if (token.type === 'identifier') {
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
  constructor(text: string) {
    const result = tokenizeText(text)
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
      if (this.peek().type === 'braceClose') {
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

    const kind = kindToken.text
    const startSpan = kindToken.span
    const startIndex = this.index

    const linkNode = this.parseLinkNode(kind, startSpan)
    if (linkNode) return linkNode

    return this.parseBlockOrStatement(kind, startSpan, startIndex)
  }

  private recoverInvalidNode(): undefined {
    this.recoverLine()
    return
  }

  private parseLinkNode(kind: string, kindSpan: SourceSpan): SyntaxNode | undefined {
    const fromToken = this.peek()
    const arrowToken = this.peek(1)
    if (fromToken.type !== 'identifier' || arrowToken.type !== 'arrow') return

    this.consume('identifier')
    this.consume('arrow')
    const toToken = this.consume('identifier')
    const attrs = this.parseAttrs()

    const endSpan = (toToken?.span ?? fromToken.span)
    const span = mergeSpan(kindSpan, endSpan)
    this.recoverLine()

    if (!toToken) return { kind, attrs: { from: fromToken.text, ...attrs }, span }
    return { kind, attrs: { from: fromToken.text, to: toToken.text, ...attrs }, span }
  }

  private parseBlockOrStatement(kind: string, kindSpan: SourceSpan, startIndex: number): SyntaxNode {
    const name = this.parseName()
    const attrs = this.parseAttrs()
    if (this.peek().type === 'braceOpen') return this.parseBlock(kind, name, attrs, kindSpan)

    const span = mergeSpan(kindSpan, this.previous(startIndex)?.span ?? kindSpan)
    this.recoverLine()
    return { kind, name, attrs, span }
  }

  private parseName(): string | undefined {
    if (this.peek().type !== 'identifier') return
    return this.consume('identifier')?.text
  }

  private parseBlock(
    kind: string,
    name: string | undefined,
    attrs: Record<string, MetaValue> | undefined,
    startSpan: SourceSpan,
  ): SyntaxNode {
    const open = this.consume('braceOpen')!
    const children = this.parseChildren()
    const close = this.consume('braceClose')
    if (!close) this.error('Missing closing brace', open.span)

    const span = mergeSpan(startSpan, close?.span ?? open.span)
    this.recoverLine()
    return { kind, name, attrs, children, span }
  }

  private parseChildren(): SyntaxNode[] {
    const children: SyntaxNode[] = []
    while (!isEndToken(this.peek()) && this.peek().type !== 'braceClose') {
      this.skipNewline()
      if (this.peek().type === 'braceClose') break
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
      if (keyToken.type !== 'identifier' || equalsToken.type !== 'equals') break

      this.index += 1
      this.index += 1

      const valueToken = this.peek()
      if (valueToken.type !== 'identifier' && valueToken.type !== 'number' && valueToken.type !== 'string') {
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

  private consume(type: Token['type']): Token | undefined {
    const token = this.peek()
    if (token.type !== type) {
      this.error(`Expected ${type} but got ${token.type}`, token.span)
      return
    }
    this.index += 1
    return token
  }

  private skipNewline(): void {
    while (this.peek().type === 'newline') this.index += 1
  }

  private recoverLine(): void {
    while (!isEndToken(this.peek()) && this.peek().type !== 'newline' && this.peek().type !== 'braceClose') {
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
export function parseText(text: string): ParseResult {
  return new TextParser(text).parse()
}
