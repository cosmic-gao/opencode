import type { BuildContext, ModelBuilder, SemanticPlugin, SyntaxNode } from './index'
import { SemanticRunner, createDocument, parseText } from './index'

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function createName(parentName: string | undefined, index: number, node: SyntaxNode): string {
  const nodeName = node.name ? `${node.kind}#${node.name}` : node.kind
  if (!parentName) return `${nodeName}:${index}`
  return `${parentName}/${nodeName}:${index}`
}

function normalizeAttributeValue(value: unknown): string {
  if (typeof value !== 'string') return String(value)
  let nextValue = value.trim()
  if (nextValue.startsWith('`') && nextValue.endsWith('`') && nextValue.length >= 2) {
    nextValue = nextValue.slice(1, -1).trim()
  }
  return nextValue
}

function toAttributeText(attrs: Record<string, unknown> | undefined): string {
  if (!attrs) return ''
  const parts: string[] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue
    if (key === 'text') continue
    if (typeof value === 'boolean') {
      if (value) parts.push(key)
      continue
    }
    parts.push(`${key}="${escapeAttribute(normalizeAttributeValue(value))}"`)
  }
  if (!parts.length) return ''
  return ` ${parts.join(' ')}`
}

class HtmlBuilder implements ModelBuilder {
  readonly name = 'html'

  supports(node: SyntaxNode): boolean {
    void node
    return true
  }

  build(node: SyntaxNode, document: ReturnType<typeof createDocument>, context: BuildContext): void {
    void context
    this.buildNode(node, document, context, undefined, 0)
  }

  private buildNode(
    node: SyntaxNode,
    document: ReturnType<typeof createDocument>,
    context: BuildContext,
    parentName: string | undefined,
    index: number,
  ): string {
    const entityName = createName(parentName, index, node)
    document.entities.push({ type: node.kind, name: entityName, attrs: node.attrs, span: node.span, meta: node.meta, tags: node.tags })

    if (parentName) {
      document.links.push({
        type: 'child',
        from: { name: parentName },
        to: { name: entityName },
        span: node.span,
      })
    }

    const children = node.children ?? []
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex]!
      this.buildNode(child, document, context, entityName, childIndex)
    }

    return entityName
  }
}

const htmlPlugin: SemanticPlugin<string, unknown> = {
  name: 'html',
  supports: () => true,
  run: (document) => {
    const entityMap = new Map(document.entities.map((entity) => [entity.name, entity] as const))
    const childMap = new Map<string, string[]>()
    const hasParent = new Set<string>()

    for (const link of document.links) {
      if (link.type !== 'child') continue
      const list = childMap.get(link.from.name) ?? []
      list.push(link.to.name)
      childMap.set(link.from.name, list)
      hasParent.add(link.to.name)
    }

    const roots = document.entities.filter((entity) => !hasParent.has(entity.name))

    function renderNode(name: string, depth: number): string {
      const entity = entityMap.get(name)
      if (!entity) return ''

      const indent = '  '.repeat(depth)
      const tag = entity.type
      const attrs = toAttributeText(entity.attrs)
      const childNames = childMap.get(name) ?? []
      const textValue = entity.attrs?.text
      const hasText = typeof textValue === 'string' && textValue.length > 0

      if (!childNames.length && !hasText) return `${indent}<${tag}${attrs}></${tag}>`
      if (!childNames.length && hasText) return `${indent}<${tag}${attrs}>${escapeText(textValue)}</${tag}>`

      const childText = childNames.map((child) => renderNode(child, depth + 1)).filter(Boolean).join('\n')
      const textLine = hasText ? `\n${indent}  ${escapeText(textValue)}` : ''
      return `${indent}<${tag}${attrs}>\n${childText}${textLine}\n${indent}</${tag}>`
    }

    return roots.map((root) => renderNode(root.name, 0)).filter(Boolean).join('\n')
  },
}

const text = `
div app id="root" {
  h1 title text="Hello Parseo"
  ul list {
    li one text="One"
    li two text="Two"
  }
  a link href="https://example.com" text="Link"
}
`

const parseResult = parseText(text)
if (parseResult.diagnostics.length) {
  console.log(parseResult.diagnostics)
  process.exit(1)
}

const document = createDocument()
const builder = new HtmlBuilder()
const context = { diagnostics: [] }
for (const node of parseResult.nodes) {
  if (builder.supports(node)) builder.build(node, document, context)
}

const runner = new SemanticRunner()
runner.register(htmlPlugin)

const htmlResult = await runner.runWith('html', document, undefined, (value) => {
  if (typeof value !== 'string') throw new Error('Invalid result')
  return value
})
console.log(htmlResult.value)
