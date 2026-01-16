import type { AdaptResult } from '../adapter'
import { JavascriptAdapter } from '../javascript/index'

/**
 * TypeScript 适配器。
 *
 * 目前复用 JavascriptAdapter 的解析逻辑（JsParser 兼容基础 TS 语法）。
 * 未来可在此扩展专用的 TsParser。
 */
export class TypescriptAdapter extends JavascriptAdapter {
  override readonly name: string = 'typescript'

  /**
   * 将 TS 代码解析为 SyntaxNode[]。
   *
   * @param text - TS 代码
   * @returns 解析结果
   */
  override parse(text: string): AdaptResult {
    // 目前复用 JsParser，它已经能识别 interface/type/enum 等关键字
    return super.parse(text)
  }
}
