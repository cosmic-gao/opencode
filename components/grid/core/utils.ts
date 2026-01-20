import type { GridItemHTMLElement, GridStackOptions, GridStackWidget } from "gridstack";
import type { GridItemOptions } from "./grid-engine";

type SubGridOptions = Omit<GridStackOptions, "children">;

const LAYOUT_KEYS = [
  'id',
  'x',
  'y',
  'w',
  'h',
  'minW',
  'minH',
  'maxW',
  'maxH',
  'noResize',
  'noMove',
  'locked',
  'static',
  'sizeToContent',
  'autoPosition',
] as const;

export interface LayoutItem {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  noResize?: boolean;
  noMove?: boolean;
  locked?: boolean;
  static?: boolean;
  sizeToContent?: boolean;
  autoPosition?: boolean;
  children?: LayoutItem[];
  data?: unknown;
}

/**
 * 将 gridstack 的保存结果转换为稳定的对外布局模型。
 *
 * 约束：
 * - 仅输出稳定字段（坐标/尺寸/锁定等）+ `children` + `data`
 * - 会把 `subGridOpts.children` 递归转换为 `children`
 *
 * @param widgets gridstack.save() 返回的 widget 列表
 * @returns 对外可持久化的布局列表（含 children）
 * @example
 * const layout = toLayout(grid.gridstack.save(false) as any)
 */
export function toLayout(widgets: GridStackWidget[]): LayoutItem[] {
  return widgets.map((widget) => {
    const record = widget as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of LAYOUT_KEYS) {
      if (record[key] !== undefined) result[key] = record[key];
    }
    if (record.data !== undefined) result.data = record.data;

    const subGridOpts = record.subGridOpts as { children?: GridStackWidget[] } | undefined;
    if (Array.isArray(subGridOpts?.children)) {
      result.children = toLayout(subGridOpts.children);
    }

    return result as LayoutItem;
  });
}

/**
 * 将稳定的对外布局模型转换为 gridstack 可加载的结构。
 *
 * 约束：
 * - 对外使用 `children` 表示嵌套；内部映射为 `subGridOpts.children`
 * - 子网格会继承传入的 subGridOptions（若提供）
 *
 * @param items 对外布局列表（含 children）
 * @param subGridOptions 子网格默认 options（不含 children）
 * @returns gridstack.load() 可直接消费的 widget 列表
 * @example
 * const widgets = fromLayout(layout, { column: 12, float: true })
 * grid.gridstack.load(widgets as any)
 */
export function fromLayout(
  items: LayoutItem[],
  subGridOptions?: SubGridOptions,
): GridStackWidget[] {
  return items.map((item) => {
    const record = item as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of LAYOUT_KEYS) {
      if (record[key] !== undefined) result[key] = record[key];
    }
    if (record.data !== undefined) result.data = record.data;

    const children = record.children as LayoutItem[] | undefined;
    if (Array.isArray(children)) {
      result.subGridOpts = {
        ...(subGridOptions ?? {}),
        children: fromLayout(children, subGridOptions),
      };
    }

    return result as GridStackWidget;
  });
}

/**
 * 将 gridstack 的保存结果规范化为对外 layout 结构。
 *
 * 约束：
 * - 对外统一使用 `children` 表示嵌套布局
 * - 会把 `subGridOpts.children` 递归转换为 `children`
 * - 仅做结构转换，不保证字段完整性（由上层决定保存哪些字段）
 *
 * @param widgets gridstack.save() 返回的 widget 列表
 * @returns 对外可序列化的布局列表（含 children）
 * @example
 * const layout = serialize(grid.gridstack.save(false) as any)
 */
export function serialize<T = unknown>(widgets: GridStackWidget[]): GridItemOptions<T>[] {
  return widgets.map((widget) => {
    const { subGridOpts, ...rest } = widget as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = { ...rest };

    const children = (subGridOpts as { children?: GridStackWidget[] } | undefined)?.children;
    if (Array.isArray(children)) {
      result.children = serialize<T>(children);
    }

    return result as GridItemOptions<T>;
  });
}

/**
 * 将对外 layout 结构转换为 gridstack 可加载的结构。
 *
 * 约束：
 * - 对外使用 `children` 表示嵌套；内部映射为 `subGridOpts.children`
 * - 子网格会继承传入的 subGridOptions（若提供）
 *
 * @param items 对外布局列表（含 children）
 * @param subGridOptions 子网格默认 options（不含 children）
 * @returns gridstack.load() 可直接消费的 widget 列表
 * @example
 * const widgets = parse(layout, { column: 12, float: true })
 * grid.gridstack.load(widgets as any)
 */
export function parse<T = unknown>(
  items: GridItemOptions<T>[],
  subGridOptions?: SubGridOptions,
): GridStackWidget[] {
  return items.map((item) => {
    const { children, ...rest } = item as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = { ...rest };

    if (Array.isArray(children)) {
      result.subGridOpts = {
        ...(subGridOptions ?? {}),
        children: parse<T>(children as GridItemOptions<T>[], subGridOptions),
      };
    }

    return result as GridStackWidget;
  });
}

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
