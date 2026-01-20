import type { DragItemOptions, GridItemOptions, GridOptions } from "../core";

export interface GridItemProps extends GridItemOptions {
  nested?: boolean;
}

export interface GridDragPortalProps extends Omit<GridItemProps, "x" | "y"> {
  target: string;
}

export interface GridProps extends GridOptions {
  modelValue?: GridItemProps[];
  name: string;
  options?: GridOptions;
  nested?: boolean;
}

export interface GridEmits {
  (e: "update:modelValue", items: GridItemProps[]): void;
  (e: "dropped", item: DragItemOptions<any>): void;
}

