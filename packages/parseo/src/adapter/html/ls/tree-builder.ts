import type { Diagnostic } from '../../../syntax/diagnostic'
import type { MetaValue, SyntaxNode } from '../../../syntax/node'
import type { HtmlLsToken } from './token'

const voidElements = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

export interface HtmlLsBuildResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

export class HtmlLsTreeBuilder {
  private readonly diagnostics: Diagnostic[] = []
  private readonly stack: Array<{ tagName: string; node: SyntaxNode }> = []
  private readonly root: SyntaxNode[] = []

  build(tokens: HtmlLsToken[], diagnostics: Diagnostic[]): HtmlLsBuildResult {
    this.diagnostics.push(...diagnostics)
    for (const token of tokens) {
      switch (token.type) {
        case 'Doctype': {
          this.appendNode({
            type: 'Doctype',
            attrs: { value: token.name },
            span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
            loc: token.span,
          })
          break
        }
        case 'Comment': {
          this.appendNode({
            type: 'Comment',
            attrs: { value: token.data },
            span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
            loc: token.span,
          })
          break
        }
        case 'Character': {
          if (!token.data) break
          const value = token.data
          const trimmed = value.trim()
          if (!trimmed) break
          this.appendNode({
            type: 'Text',
            attrs: { value: trimmed },
            span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
            loc: token.span,
          })
          break
        }
        case 'StartTag': {
          const attrs: Record<string, MetaValue> = {}
          for (const [k, v] of Object.entries(token.attrs)) attrs[k] = v
          const element: SyntaxNode = {
            type: 'Element',
            name: token.tagName,
            attrs,
            children: [],
            span: { start: token.span.start.offset, end: token.span.end.offset, ctxt: 0 },
            loc: token.span,
          }
          this.appendNode(element)

          const isVoid = voidElements.has(token.tagName)
          if (!token.selfClosing && !isVoid) {
            this.stack.push({ tagName: token.tagName, node: element })
          }
          break
        }
        case 'EndTag': {
          this.popUntil(token.tagName)
          break
        }
        case 'EOF': {
          this.stack.length = 0
          break
        }
      }
    }
    return { nodes: this.root, diagnostics: this.diagnostics }
  }

  private appendNode(node: SyntaxNode): void {
    const parent = this.stack[this.stack.length - 1]?.node
    if (parent && parent.children) {
      parent.children.push(node)
      return
    }
    this.root.push(node)
  }

  private popUntil(tagName: string): void {
    while (this.stack.length) {
      const entry = this.stack.pop()!
      if (entry.tagName === tagName) return
    }
  }
}
