import type { BuildContext, ModelBuilder } from '../model/builder'
import type { SyntaxNode } from '../syntax/node'
import type { NeutralDocument } from '../neutral/document'
import type { NeutralEntity, NeutralLink } from '../neutral/entity'

function hasEntity(document: NeutralDocument, type: string, name: string): boolean {
  return document.entities.some((entity) => entity.type === type && entity.name === name)
}

/**
 * Flow DSL 的参考构建器实现。
 *
 * 支持的语法 kind：
 * - flow { node ...; edge A -> B }
 */
export class FlowBuilder implements ModelBuilder {
  readonly name = 'flow'

  supports(node: SyntaxNode): boolean {
    return node.kind === 'flow'
  }

  build(node: SyntaxNode, document: NeutralDocument, context: BuildContext): void {
    void context
    const flowName = node.name ?? 'Flow'
    if (!hasEntity(document, 'flow', flowName)) {
      const flowEntity: NeutralEntity = { type: 'flow', name: flowName, attrs: node.attrs, span: node.span, meta: node.meta, tags: node.tags }
      document.entities.push(flowEntity)
    }

    for (const child of node.children ?? []) {
      if (child.kind === 'node') {
        const nodeName = child.name
        if (!nodeName) continue
        if (hasEntity(document, 'node', nodeName)) continue
        const item: NeutralEntity = { type: 'node', name: nodeName, attrs: child.attrs, span: child.span, meta: child.meta, tags: child.tags }
        document.entities.push(item)
      }

      if (child.kind === 'edge') {
        const from = String(child.attrs?.from ?? '')
        const to = String(child.attrs?.to ?? '')
        if (!from || !to) continue
        const link: NeutralLink = {
          type: 'edge',
          from: { name: from },
          to: { name: to },
          attrs: child.attrs,
          span: child.span,
          meta: child.meta,
          tags: child.tags,
        }
        document.links.push(link)
      }
    }
  }
}
