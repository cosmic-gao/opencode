import type { SourceSpan } from './diagnostic'

export type MetaValue = null | boolean | number | string | MetaValue[] | { [key: string]: MetaValue }

export type MetaStore = Record<string, Record<string, MetaValue>>

export interface SwcSpan {
  start: number
  end: number
  ctxt: number
}

export interface SyntaxNode {
  type: string
  name?: string
  attrs?: Record<string, MetaValue>
  children?: SyntaxNode[]
  span?: SwcSpan
  loc?: SourceSpan
  meta?: MetaStore
  tags?: string[]
}

/**
 * 创建语法节点对象。
 *
 * @param params - 节点字段
 * @returns 语法节点
 */
export function createNode(params: SyntaxNode): SyntaxNode {
  return params
}
