import type { Diagnostic, SourceSpan } from '../../syntax/diagnostic'
import type { MetaValue, SyntaxNode } from '../../syntax/node'
import type { HtmlToken, HtmlTokenType } from './lexer'
import { HtmlLexer } from './lexer'

export interface HtmlParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

export class HtmlParser {
  private tokens: HtmlToken[] = []
  private index = 0
  private diagnostics: Diagnostic[] = []

  parse(text: string): HtmlParseResult {
    const lexer = new HtmlLexer(text)
    const result = lexer.tokenize()
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

    return undefined
  }

  private parseElement(): SyntaxNode | undefined {
    const startToken = this.consume('startTagOpen')
    if (!startToken) return undefined

    const nameToken = this.consume('tagName')
    if (!nameToken) return undefined
    const tagName = nameToken.text.toLowerCase()

    const attrs: Record<string, MetaValue> = {}
    while (this.peek().type === 'attrName') {
      const attrName = this.consume('attrName')!.text
      let attrValue: MetaValue = true

      if (this.peek().type === 'equals') {
        this.consume('equals')
        const valToken = this.consume('attrValue')
        if (valToken) {
          attrValue = valToken.text
        }
      }
      attrs[attrName] = attrValue
    }

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

    const children: SyntaxNode[] = []
    const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']

    if (!voidElements.includes(tagName)) {
      while (!this.isEnd()) {
        if (this.peek().type === 'endTagOpen') {
          let i = 1
          while (this.peek(i).type !== 'tagName' && this.peek(i).type !== 'eof') i++
          if (this.peek(i).text.toLowerCase() === tagName) {
            break
          } else {
            break
          }
        }

        const startIndex = this.index
        const child = this.parseNode()
        if (child) {
          children.push(child)
        } else if (this.index === startIndex) {
          if (this.peek().type !== 'endTagOpen') {
            this.advance()
          }
        }
      }

      this.consume('endTagOpen')
      this.consume('tagName')
      const endToken = this.consume('startTagClose')

      const endSpan = endToken?.span.end ?? this.peek(-1).span.end
      return {
        type: 'Element',
        name: tagName,
        attrs,
        children,
        span: { start: startToken.span.start.offset, end: endSpan.offset, ctxt: 0 },
        loc: { start: startToken.span.start, end: endSpan },
      }
    }

    return {
      type: 'Element',
      name: tagName,
      attrs,
      span: { start: startToken.span.start.offset, end: this.peek(-1).span.end.offset, ctxt: 0 },
      loc: { start: startToken.span.start, end: this.peek(-1).span.end },
    }
  }

  private peek(offset = 0): HtmlToken {
    const index = this.index + offset
    if (index < 0) return this.tokens[0]!
    return this.tokens[index] || { type: 'eof', text: '', span: zeroSpan() }
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
    if (this.peek().type === type) return this.advance()
    return undefined
  }
}

function zeroSpan(): SourceSpan {
  return { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } }
}

