import { isVue2 } from "vue-demi";

export function createAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return isVue2 ? { attrs } : attrs;
}

