import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type ShallowRef,
  watch
} from "vue-demi";
import { createGrid, createId, type GridEngine } from "../core";
import { provideGrid, provideGridModel } from "./grid.context";
import type { GridEmits, GridItemProps, GridProps } from "./grid.type";

export function useGrid(
  props: GridProps,
  emit: GridEmits,
  el: ShallowRef<HTMLElement | null>
) {
  const grid: ShallowRef<GridEngine | null> = shallowRef(null);
  let rafId: number | null = null;
  let isInteracting = false;
  let isSyncingFromGrid = false;

  provideGrid(grid);

  // --- Data Management ---

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
    isSyncingFromGrid = true;
    items.value = next.map(ensureId);
    isSyncingFromGrid = false;
  };

  const updateItem = (id: string, patch: Partial<GridItemProps>) => {
    items.value = items.value.map((item) => (item.id === id ? ({ ...item, ...patch } as GridItemProps) : item));
  };

  provideGridModel({ updateItem, replaceItems });

  // --- Sync Logic ---

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

  // --- Engine Lifecycle & Events ---

  onMounted(() => {
    if (!el.value) return;

    const finalOptions = { ...(props.options ?? {}), id: props.name };
    grid.value = createGrid(el.value, finalOptions);

    // Initial sync: Vue -> Grid
    replaceItems(items.value);

    // Watch for Vue -> Grid sync: when items.value changes externally, sync to Grid
    watch(
      () => props.modelValue,
      (newItems) => {
        if (!grid.value || isSyncingFromGrid || isInteracting) return;
        if (newItems) {
          grid.value.sync(newItems);
        }
      },
      { deep: true }
    );

    // Event Listeners
    grid.value.on("dropped", ({ node }) => {
      emit("dropped", node);
      scheduleSync();
    });

    grid.value.on("change", () => {
      if (isInteracting) return;
      scheduleSync();
    });

    grid.value.on("removed", (nodes) => {
      emit("removed", nodes);
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

  return {
    grid,
    items
  };
}
