import type { NeutralDocument } from '../neutral/document'

/**
 * 解释中立文档的语义插件接口。
 *
 * @typeParam T - 结果值类型
 * @typeParam C - 外部执行上下文类型
 */
export interface SemanticPlugin<T = unknown, C = unknown> {
  name: string
  required?: string[]
  before?: string[]
  after?: string[]
  supports(document: NeutralDocument): boolean
  prepare?(document: NeutralDocument, context: C): void | Promise<void>
  run(document: NeutralDocument, context: C): T | Promise<T>
}
