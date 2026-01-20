import { isVue2 } from "vue-demi";
import type { VNode } from "vue-demi";

/**
 * 创建 Vue2/Vue3 兼容的属性对象
 * @param attrs 属性对象
 * @returns Vue2 包装后的 attrs 或 Vue3 直接使用的 attrs
 */
export function createAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return isVue2 ? { attrs } : attrs;
}

/**
 * 将对象转为 Props 类型
 * @param props 属性对象
 * @returns 标准化的 props 对象
 */
export function toProps<T extends Record<string, unknown>>(props: T): Record<string, unknown> {
  return props as Record<string, unknown>;
}

/**
 * 安全渲染 VNode
 * @param node VNode 对象
 * @returns VNode 或 VNode 数组
 */
export function render(node: VNode | VNode[]): VNode | VNode[] {
  return node;
}