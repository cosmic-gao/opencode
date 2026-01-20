import { type InjectionKey, type ShallowRef, inject, provide } from "vue-demi";
import type { GridEngine } from "../core";

const gridKey: InjectionKey<ShallowRef<GridEngine | null>> = Symbol("GridContext");

export function provideGrid(grid: ShallowRef<GridEngine | null>) {
  provide(gridKey, grid);
}

export function useGrid(): ShallowRef<GridEngine | null> {
  const grid = inject(gridKey, null);
  if (!grid) {
    throw new Error("Grid context is not provided");
  }
  return grid;
}

