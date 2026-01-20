import type { PropType } from "vue-demi";
import type { DragItemOptions, GridItemOptions, GridOptions } from "../core";

export interface GridItemProps extends GridItemOptions {
  nested?: boolean;
}

export const GridItemProps = {
  id: { type: String, default: undefined },
  w: { type: Number, default: undefined },
  h: { type: Number, default: undefined },
  maxW: { type: Number, default: undefined },
  maxH: { type: Number, default: undefined },
  minW: { type: Number, default: undefined },
  minH: { type: Number, default: undefined },
  noResize: { type: Boolean, default: undefined },
  noMove: { type: Boolean, default: undefined },
  locked: { type: Boolean, default: undefined },
  static: { type: Boolean, default: undefined },
  sizeToContent: { type: Boolean, default: undefined },
  autoPosition: { type: Boolean, default: undefined },
  nested: { type: Boolean, default: false },
  children: { type: Array as PropType<GridItemOptions[]>, default: undefined }
};

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
  (e: "dropped", item: DragItemOptions<unknown>): void;
  (e: "removed", items: GridItemOptions[]): void;
}
