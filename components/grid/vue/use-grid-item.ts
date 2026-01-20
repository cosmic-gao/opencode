import { onBeforeUnmount, onMounted, type Ref, ref, type ShallowRef, watch } from 'vue-demi';
import { type GridItem as GridItemInstance, GridUtils } from '../core';
import { GRID_ITEM_KEYS } from './grid.const';
import { useGridContext } from './grid.context';
import type { GridItemProps } from './grid.type';

export function useGridItem(
  props: GridItemProps,
  el: ShallowRef<HTMLElement | null>,
) {
  const item: Ref<GridItemInstance | null> = ref(null);
  const grid = useGridContext();
  let isInitializing = true;

  const initItem = () => {
    if (!el.value || !grid.value) return;
    if (item.value) return;

    item.value = grid.value.addItem(el.value, props);
  };

  watch(
    GRID_ITEM_KEYS.map((key) => () => props[key]),
    () => {
      if (isInitializing || !el.value || !grid.value) return;
      const options = GridUtils.pick(props, GRID_ITEM_KEYS as readonly (keyof GridItemProps)[]);
      grid.value.updateItem(el.value, options);
    },
  );

  watch(
    () => props.noResize,
    (noResize: boolean | undefined) => {
      if (!el.value || !grid.value) return;
      grid.value.gridstack.resizable(el.value, !!noResize);
    },
  );

  watch(
    () => props.noMove,
    (noMove: boolean | undefined) => {
      if (!el.value || !grid.value) return;
      grid.value.gridstack.movable(el.value, !!noMove);
    },
  );

  onMounted(() => {
    initItem();

    if (!item.value) {
      const stop = watch(grid, (newGrid) => {
        if (newGrid) {
          initItem();
          if (item.value) stop();
        }
      });
    }

    // 初始化完成后，允许响应 props 变化
    isInitializing = false;
  });

  onBeforeUnmount(() => {
    if (!el.value || !grid.value) return;
    grid.value.removeItem(el.value);
    item.value = null;
  });

  return {
    item,
  };
}
