import { type InjectionKey, type ShallowRef, inject, provide } from "vue-demi";
import type { GridEngine } from "../core";
import type { GridItemProps } from "./grid.type";

const gridKey: InjectionKey<ShallowRef<GridEngine | null>> = Symbol("GridContext");
const modelKey: InjectionKey<{
  updateItem: (id: string, patch: Partial<GridItemProps>) => void;
  replaceItems: (items: GridItemProps[]) => void;
}> = Symbol("GridModelContext");

/**
 * 提供网格实例到子组件
 * @param grid 网格实例的响应式引用
 */
export function provideGrid(grid: ShallowRef<GridEngine | null>) {
  provide(gridKey, grid);
}

/**
 * 提供网格数据模型操作方法到子组件
 * @param model 包含 updateItem 和 replaceItems 的操作对象
 */
export function provideGridModel(model: {
  updateItem: (id: string, patch: Partial<GridItemProps>) => void;
  replaceItems: (items: GridItemProps[]) => void;
}) {
  provide(modelKey, model);
}

/**
 * 获取父级网格实例
 * 
 * 必须在 Grid 组件的子组件中调用，否则抛出错误。
 * 
 * @returns 网格实例的响应式引用
 * @throws 若未找到 Grid 上下文则抛出错误
 */
export function useGrid(): ShallowRef<GridEngine | null> {
  const grid = inject(gridKey, null);
  if (!grid) {
    throw new Error("Grid context is not provided. useGrid() must be called within a Grid component.");
  }
  return grid;
}

/**
 * 获取父级网格数据模型操作方法
 * 
 * 必须在 Grid 组件的子组件中调用，否则抛出错误。
 * 
 * @returns 数据模型操作对象，包含 updateItem 和 replaceItems 方法
 * @throws 若未找到 Grid 模型上下文则抛出错误
 */
export function useGridModel(): {
  updateItem: (id: string, patch: Partial<GridItemProps>) => void;
  replaceItems: (items: GridItemProps[]) => void;
} {
  const model = inject(modelKey, null);
  if (!model) {
    throw new Error("Grid model context is not provided. useGridModel() must be called within a Grid component.");
  }
  return model;
}
