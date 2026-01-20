import { isVue2 } from "vue-demi";

/**
 * 创建 Vue2/Vue3 兼容的属性对象
 * @param attrs 属性对象
 * @returns Vue2 包装后的 attrs 或 Vue3 直接使用的 attrs
 */
export function createAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return isVue2 ? { attrs } : attrs;
}
