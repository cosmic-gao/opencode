import { type GridItemHTMLElement } from "gridstack";
import { type GridItemOptions } from "./grid-engine";

export class GridUtils {
  /**
   * 从对象中提取指定键的子集
   * @param obj 源对象
   * @param keys 要提取的键数组
   * @returns 包含指定键的新对象
   */
  public static pick<T extends object, K extends keyof T>(
    obj: T,
    keys: readonly K[]
  ): Pick<T, K> {
    return keys.reduce((res, key) => {
      if (Object.hasOwn(obj, key)) res[key] = obj[key]
      return res
    }, {} as Pick<T, K>)
  }

  /**
   * 移除对象中值为 undefined 的属性
   * @param obj 源对象
   * @returns 移除 undefined 属性后的新对象
   */
  public static trimmed<T extends GridItemOptions>(obj: T): Partial<T> {
    const result = {} as T;
    for (const key in obj) {
      if (obj[key] !== undefined) result[key] = obj[key];
    }
    return result;
  }

  /**
   * 获取 DOM 元素
   * @param els 元素选择器或 HTMLElement
   * @returns HTMLElement 实例
   * @throws 若选择器未找到元素则抛出错误
   */
  public static getElement(els: string | HTMLElement): HTMLElement {
    if (typeof els === 'string') {
      const element = document.querySelector(els) as HTMLElement | null;
      if (!element) {
        throw new Error(`Element not found: ${els}`);
      }
      return element;
    }
    return els;
  }

  /**
   * 检查元素是否为网格项
   * @param els 元素选择器或 HTMLElement
   * @returns 是否为网格项
   */
  public static isElement(els: string | HTMLElement): boolean {
    try {
      const el = GridUtils.getElement(els) as GridItemHTMLElement;
      return !!el.gridstackNode;
    } catch {
      return false;
    }
  }

  /**
   * 获取网格项 ID
   * @param els 元素选择器或 HTMLElement
   * @returns 网格项 ID
   * @throws 若未找到 ID 则抛出错误
   */
  public static getId(els: string | HTMLElement): string {
    if (typeof els === 'string') return els;
    const id = els.getAttribute('gs-id');
    if (!id) {
      throw new Error('Grid item ID not found on element');
    }
    return id;
  }
}
