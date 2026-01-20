import {
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  type ShallowRef,
  type VNode,
  shallowRef,
  computed,
  onMounted,
  onBeforeUnmount,
  resolveComponent
} from "vue-demi";
import type { DragItemOptions, GridEngine } from "../core";
import { createGrid } from "../core";
import { provideGrid } from "./grid.context";
import type { GridItemProps, GridProps } from "./grid.type";

const gridEmits = {
  "update:modelValue": (items: GridItemProps[]) => Array.isArray(items),
  dropped: (item: DragItemOptions<unknown>) => item !== null
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
    const grid: ShallowRef<GridEngine | null> = shallowRef(null);

    provideGrid(grid);

    const items = computed<GridItemProps[]>({
      get: () => props.modelValue ?? [],
      set: (value: GridItemProps[]) => emit("update:modelValue", value)
    });

    onMounted(() => {
      if (!el.value) return;

      const finalOptions = { ...(props.options ?? {}), id: props.name };
      grid.value = createGrid(el.value, finalOptions);

      grid.value.on("dropped", ({ node }: { node: DragItemOptions<unknown> }) => {
        items.value = [...items.value, node as unknown as GridItemProps];
        emit("dropped", node);
      });
    });

    onBeforeUnmount(() => {
      grid.value?.destroy();
      grid.value = null;
    });

    return (): VNode => {
      const GridItemComponent = resolveComponent("GridItem");
      return h(
        "div",
        {
          ref: el,
          class: ["grid-stack", "sylas-grid-vue", props.nested ? "grid-stack-nested" : null]
        },
        slots.default
          ? slots.default()
          : items.value.map((item: GridItemProps) =>
              h(
                GridItemComponent,
                { key: item.id, ...item },
                slots.default ? { default: () => slots.default?.({ item }) } : undefined
              )
            )
      );
    };
  }
});
