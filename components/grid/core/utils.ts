import { type GridItemHTMLElement } from "gridstack";
import { type GridItemOptions } from "./grid-engine";

export class GridUtils {
  public static pick<T extends object, K extends keyof T>(
    obj: T,
    keys: readonly K[]
  ): Pick<T, K> {
    return keys.reduce((res, key) => {
      if (Object.hasOwn(obj, key)) res[key] = obj[key]
      return res
    }, {} as Pick<T, K>)
  }

  public static trimmed<T extends GridItemOptions>(obj: T): Partial<T> {
    const result = {} as T;
    for (const key in obj) {
      if (obj[key] !== undefined) result[key] = obj[key];
    }
    return result;
  }

  public static getElement(els: string | HTMLElement): HTMLElement {
    return typeof els === 'string'
      ? document.querySelector(els) as HTMLElement
      : els
  }

  public static isElement(els: string | HTMLElement): boolean {
    const el = GridUtils.getElement(els) as GridItemHTMLElement;
    return !!el.gridstackNode
  }

  public static getId(els: string | HTMLElement): string {
    return typeof els === 'string' ? els : els.getAttribute('gs-id')!
  }
}
