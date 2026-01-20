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

  const initItem = () => {
    if (!el.value || !grid.value) return;
    // 如果 item 已经初始化，不再重复添加
    if (item.value) return;

    // GridStack 引擎会自动处理 DOM 已经在容器中的情况
    // 这里调用 addItem 是为了获取包装后的 GridItem 实例引用，并确保数据同步
    item.value = grid.value.addItem(el.value, props);
  };

  // Watchers for reactive updates
  watch(
    GRID_ITEM_KEYS.map((key) => () => props[key]),
    () => {
      if (!el.value || !grid.value) return;
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

  // Lifecycle
  onMounted(() => {
    // 尝试初始化
    initItem();

    // 如果初始化时 grid 尚未就绪（常见情况），监听 grid 变化
    if (!item.value) {
      const stop = watch(grid, (newGrid) => {
        if (newGrid) {
          initItem();
          if (item.value) stop(); // 初始化成功后停止监听
        }
      });
    }
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
