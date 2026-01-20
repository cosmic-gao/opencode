import {
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  type ShallowRef,
  type VNode,
  type Component,
  shallowRef,
  computed,
  onMounted,
  onBeforeUnmount
} from "vue-demi";
import type { DragItemOptions, GridEngine } from "../core";
import { createGrid, createId } from "../core";
import { provideGrid, provideGridModel } from "./grid.context";
import { GridItem } from "./grid-item";
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
    let rafId: number | null = null;
    let isInteracting = false;

    provideGrid(grid);

    const items = computed<GridItemProps[]>({
      get: () => props.modelValue ?? [],
      set: (value: GridItemProps[]) => emit("update:modelValue", value)
    });

    const ensureId = (item: GridItemProps): GridItemProps => {
      if (item.id) return item;
      return { ...item, id: createId() };
    };

    const mergeItems = (next: GridItemProps[], prev: GridItemProps[]): GridItemProps[] => {
      const prevMap = new Map(prev.map((item) => [item.id, item]));
      return next.map((item) => {
        const base = prevMap.get(item.id);
        return base ? ({ ...base, ...item } as GridItemProps) : item;
      });
    };

    const replaceItems = (next: GridItemProps[]) => {
      items.value = next.map(ensureId);
    };

    const updateItem = (id: string, patch: Partial<GridItemProps>) => {
      items.value = items.value.map((item) => (item.id === id ? ({ ...item, ...patch } as GridItemProps) : item));
    };

    provideGridModel({ updateItem, replaceItems });

    onMounted(() => {
      if (!el.value) return;

      const finalOptions = { ...(props.options ?? {}), id: props.name };
      grid.value = createGrid(el.value, finalOptions);

      replaceItems(items.value);

      const syncFromGrid = () => {
        if (!grid.value) return;
        const next = mergeItems(grid.value.getItems() as GridItemProps[], items.value);
        replaceItems(next);
      };

      const scheduleSync = () => {
        if (rafId !== null) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          syncFromGrid();
        });
      };

      grid.value.on("dropped", ({ node }) => {
        emit("dropped", node);
        scheduleSync();
      });

      grid.value.on("change", () => {
        if (isInteracting) return;
        scheduleSync();
      });

      grid.value.on("removed", () => {
        scheduleSync();
      });

      grid.value.on("dragstart", () => {
        isInteracting = true;
      });
      grid.value.on("resizestart", () => {
        isInteracting = true;
      });
      grid.value.on("dragstop", () => {
        isInteracting = false;
        scheduleSync();
      });
      grid.value.on("resizestop", () => {
        isInteracting = false;
        scheduleSync();
      });
    });

    onBeforeUnmount(() => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      grid.value?.destroy();
      grid.value = null;
    });

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
