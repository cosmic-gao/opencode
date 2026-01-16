import type { Diagnostic } from '../syntax/diagnostic'
import type { SyntaxNode } from '../syntax/node'

/**
 * 适配器解析结果。
 */
export interface AdaptResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

/**
 * 适配器接口：将非 DSL 文本转换为 SyntaxNode[]。
 *
 * 适配器是扩展不同语言支持的入口，使外部格式（HTML、JSON 等）能进入
 * Parseo 的建模/语义流程。
 */
export interface Adapter {
  /**
   * 适配器名称。
   */
  name: string

  /**
   * 判断输入文本是否可被本适配器处理。
   *
   * @param text - 待判断文本
   * @returns 是否支持
   */
  supports(text: string): boolean

  /**
   * 将文本解析为 SyntaxNode 列表。
   *
   * @param text - 输入文本
   * @returns 解析结果（节点 + 诊断）
   */
  parse(text: string): AdaptResult
}
