import type { AdaptResult, Adapter } from '../../adapter'
import { JsParser } from './parser'

/**
 * JavaScript 适配器。
 *
 * 使用纯 JS 实现的 JsParser 将 JS 代码解析为 SyntaxNode[]。
 */
export class JavascriptAdapter implements Adapter {
  readonly name: string = 'javascript'

  /**
   * 判断输入文本是否为 JS 代码。
   *
   * JS 很难通过简单规则判断，这里默认返回 false，通常由上层逻辑指定调用。
   */
  supports(_text: string): boolean {
    return false
  }

  /**
   * 将 JS 代码解析为 SyntaxNode[]。
   *
   * @param text - JS 代码
   * @returns 解析结果
   */
  parse(text: string): AdaptResult {
    const parser = new JsParser()
    return parser.parse(text)
  }
}
