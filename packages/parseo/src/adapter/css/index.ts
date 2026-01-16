import type { AdaptResult, Adapter } from '../../adapter'
import { CssParser } from './parser'

/**
 * CSS 适配器。
 *
 * 使用纯 JS 实现的 CssParser 将 CSS 代码解析为 SyntaxNode[]。
 */
export class CssAdapter implements Adapter {
  readonly name: string = 'css'

  /**
   * 判断输入文本是否为 CSS 代码。
   */
  supports(_text: string): boolean {
    return false
  }

  /**
   * 将 CSS 代码解析为 SyntaxNode[]。
   *
   * @param text - CSS 代码
   * @returns 解析结果
   */
  parse(text: string): AdaptResult {
    const parser = new CssParser()
    return parser.parse(text)
  }
}
