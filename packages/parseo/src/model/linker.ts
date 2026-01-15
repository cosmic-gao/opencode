import type { Diagnostic } from '../syntax/diagnostic'
import type { NeutralDocument } from '../neutral/document'

export interface LinkResult {
  diagnostics: Diagnostic[]
}

/**
 * 解析并校验中立文档内的引用关系。
 *
 * 当前行为：按实体名称校验 link 的 from/to 是否存在。
 *
 * @param document - 中立文档
 * @returns 缺失引用的诊断信息
 */
export function linkDocument(document: NeutralDocument): LinkResult {
  const diagnostics: Diagnostic[] = []
  const nameSet = new Set(document.entities.map((entity) => entity.name))

  for (const link of document.links) {
    if (!nameSet.has(link.from.name)) {
      diagnostics.push({
        level: 'error',
        code: 'link',
        message: `Missing reference: ${link.from.name}`,
        span: link.span,
      })
    }
    if (!nameSet.has(link.to.name)) {
      diagnostics.push({
        level: 'error',
        code: 'link',
        message: `Missing reference: ${link.to.name}`,
        span: link.span,
      })
    }
  }

  return { diagnostics }
}
