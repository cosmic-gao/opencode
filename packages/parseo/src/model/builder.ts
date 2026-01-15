import type { Diagnostic } from '../syntax/diagnostic'
import type { SyntaxNode } from '../syntax/node'
import type { NeutralDocument } from '../neutral/document'

export interface BuildContext {
  diagnostics: Diagnostic[]
}

/**
 * 将语法节点转换为中立文档的构建器接口。
 *
 * 构建器是扩展 DSL 能力的第一扩展点：新增能力通过新增构建器实现，
 * 不需要修改解析器。
 */
export interface ModelBuilder {
  name: string
  supports(node: SyntaxNode): boolean
  build(node: SyntaxNode, document: NeutralDocument, context: BuildContext): void
}
