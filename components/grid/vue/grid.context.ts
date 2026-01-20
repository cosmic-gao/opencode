import { type InjectionKey, type ShallowRef, inject, provide } from "vue-demi";
import type { GridEngine } from "../core";
import type { GridItemProps } from "./grid.type";

const gridKey: InjectionKey<ShallowRef<GridEngine | null>> = Symbol("GridContext");
const modelKey: InjectionKey<{
  updateItem: (id: string, patch: Partial<GridItemProps>) => void;
  replaceItems: (items: GridItemProps[]) => void;
}> = Symbol("GridModelContext");

export function provideGrid(grid: ShallowRef<GridEngine | null>) {
  provide(gridKey, grid);
}

export function provideGridModel(model: {
  updateItem: (id: string, patch: Partial<GridItemProps>) => void;
  replaceItems: (items: GridItemProps[]) => void;
}) {
  provide(modelKey, model);
}

export function useGrid(): ShallowRef<GridEngine | null> {
  const grid = inject(gridKey, null);
  if (!grid) {
    throw new Error("Grid context is not provided");
  }
  return grid;
}

export function useGridModel(): {
  updateItem: (id: string, patch: Partial<GridItemProps>) => void;
  replaceItems: (items: GridItemProps[]) => void;
} {
  const model = inject(modelKey, null);
  if (!model) {
    throw new Error("Grid model context is not provided");
  }
  return model;
}
