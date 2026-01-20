import {
  defineComponent,
  h,
  onBeforeUnmount,
  nextTick,
  type PropType,
  type SetupContext,
  type ShallowRef,
  shallowRef,
  watch,
} from 'vue-demi';
import type { DragItemOptions, GridEngine } from '../core';
import { GridFactory } from '../core';
import { GridItemProps } from './grid.type';

export const GridDragPortal = defineComponent({
  name: 'GridDragPortal',
  props: {
    target: { type: String, required: true },
    ...GridItemProps,
    data: { type: null as unknown as PropType<unknown> },
  },
  setup(props, { slots }: SetupContext) {
    const el: ShallowRef<HTMLElement | null> = shallowRef(null);
    const grid: ShallowRef<GridEngine | null> = shallowRef(null);
    let setupVersion = 0;

    const setupDrag = async (name: string | undefined): Promise<void> => {
      const version = (setupVersion += 1);
      if (!name) return;

      if (!el.value) await nextTick();
      const dom = el.value;
      if (!dom) return;

      try {
        const instance = GridFactory.getInstance();
        const engine = await instance.waitForGrid(name);
        if (version !== setupVersion) return;
        grid.value = engine;
        if (!grid.value) return;

        const { target: _, ...options } = props;
        grid.value.driver.setupDragIn(dom, options as unknown as DragItemOptions<unknown>);
      } catch {
        return;
      }
    };

    watch(
      () => props.target,
      (name: string) => {
        if (grid.value && el.value) {
          grid.value.driver.destroyDragIn(el.value);
        }
        void setupDrag(name);
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      setupVersion += 1;
      if (grid.value && el.value) grid.value.driver.destroyDragIn(el.value);
      grid.value = null;
    });

    return () =>
      h(
        'div',
        {
          ref: el,
          class: ['grid-stack-item', 'oc-grid-drag-portal', 'grid-drag-portal'],
          tabindex: 0,
        },
        h('div', { class: 'grid-stack-item-content' }, slots.default?.()),
      );
  },
});
