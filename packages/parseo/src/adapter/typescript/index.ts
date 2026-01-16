import { JavascriptAdapter } from '../javascript/index'

/**
 * TypeScript 适配器。
 *
 * 目前复用 JavascriptAdapter 的解析逻辑（JsParser 兼容基础 TS 语法）。
 * 未来可在此扩展专用的 TsParser。
 */
export class TypescriptAdapter extends JavascriptAdapter {
  override readonly name: string = 'typescript'
}
