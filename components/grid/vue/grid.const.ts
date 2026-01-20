import type { GridItemProps } from "./grid.type";
import { GRID_ITEM_ATTRS } from "../core";

export const GRID_ITEM_KEYS: (keyof GridItemProps)[] = Object.keys(GRID_ITEM_ATTRS)
  .filter((key) => key !== "noResize" && key !== "noMove") as (keyof GridItemProps)[];

