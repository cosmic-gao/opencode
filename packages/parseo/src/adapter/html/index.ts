import type { Adapter, AdaptResult } from '../../adapter'
import { HtmlLsParser } from './ls/parser'

export * from './lexer'
export * from './parser'
export * from './ls/parser'

/**
 * 原生 HTML 适配器。
 *
 * 使用纯 JS 实现的 HtmlParser 将 HTML 字符串解析为 SyntaxNode[]。
 * 不再依赖浏览器的 DOMParser。
 */
export class HtmlAdapter implements Adapter {
  readonly name: string = 'html'

  /**
   * 判断输入文本是否为 HTML 结构。
   *
   * @param text - 输入文本
   * @returns 是否以 `<` 开头（简易检测）
   */
  supports(text: string): boolean {
    return text.trimStart().startsWith('<')
  }

  /**
   * 将 HTML 字符串解析为 SyntaxNode[]。
   *
   * @param text - HTML 文本
   * @returns 解析结果
   */
  parse(text: string): AdaptResult {
    const parser = new HtmlLsParser()
    return parser.parse(text)
  }
}
