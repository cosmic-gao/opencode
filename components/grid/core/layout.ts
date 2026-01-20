import type { GridStackOptions, GridStackWidget } from "gridstack";
import type { GridItemOptions } from "./grid-engine";

type SubGridOptions = Omit<GridStackOptions, "children">;

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
export function serialize(widgets: GridStackWidget[]): GridItemOptions[] {
  return widgets.map((widget) => {
    const { subGridOpts, ...rest } = widget as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = { ...rest };

    const children = (subGridOpts as { children?: GridStackWidget[] } | undefined)?.children;
    if (Array.isArray(children)) {
      result.children = serialize(children);
    }

    return result as GridItemOptions;
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
export function parse(
  items: GridItemOptions[],
  subGridOptions?: SubGridOptions,
): GridStackWidget[] {
  return items.map((item) => {
    const { children, ...rest } = item as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = { ...rest };

    if (Array.isArray(children)) {
      result.subGridOpts = {
        ...(subGridOptions ?? {}),
        children: parse(children as GridItemOptions[], subGridOptions),
      };
    }

    return result as GridStackWidget;
  });
}
