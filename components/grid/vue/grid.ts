import {
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  type ShallowRef,
  type VNode,
  type Component,
  shallowRef
} from "vue-demi";
import type { DragItemOptions, GridItemOptions } from "../core";
import { GridItem } from "./grid-item";
import type { GridItemProps, GridProps } from "./grid.type";
import { useGrid } from "./use-grid";

const gridEmits = {
  "update:modelValue": (items: GridItemProps[]) => Array.isArray(items),
  dropped: (item: DragItemOptions<unknown>) => item !== null,
  removed: (items: GridItemOptions[]) => Array.isArray(items)
};

type GridEmitsType = typeof gridEmits;

export const Grid = defineComponent({
  name: "Grid",
  props: {
    name: { type: String, required: true },
    modelValue: { type: Array as PropType<GridItemProps[]>, default: undefined },
    options: { type: Object as PropType<GridProps["options"]>, default: undefined },
    nested: { type: Boolean, default: false }
  },
  emits: gridEmits,
  setup(props, { emit, slots }: SetupContext<GridEmitsType>): () => VNode {
    const el: ShallowRef<HTMLElement | null> = shallowRef(null);
    
    // 使用核心 Hook
    const { items } = useGrid(props, emit, el);

    return (): VNode => {
      return h(
        "div",
        {
          ref: el,
          class: ["grid-stack", "oc-grid-vue", props.nested ? "grid-stack-nested" : null]
        },
        slots.default
          ? slots.default()
          : items.value.map((item: GridItemProps) =>
              h(
                GridItem as Component,
                { key: item.id, ...item },
                slots.default ? { default: () => slots.default?.({ item }) } : undefined
              )
            )
      );
    };
  }
});
