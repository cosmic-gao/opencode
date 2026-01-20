import {
  type Component,
  computed,
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  type ShallowRef,
  shallowRef,
  type VNode,
} from 'vue-demi';
import { createId, GRID_ITEM_ATTRS, type GridItemOptions } from '../core';
import { Grid } from './grid';
import { useGridModel } from './grid.context';
import type { GridItemProps } from './grid.type';
import { createAttrs } from './vue';
import { useGridItem } from './use-grid-item';

export const GridItem = defineComponent({
  name: 'GridItem',
  props: {
    id: { type: String, default: undefined },
    x: { type: Number, default: undefined },
    y: { type: Number, default: undefined },
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
    children: { type: Array as PropType<GridItemOptions[]>, default: undefined },
  },
  setup(props, { slots }: SetupContext): () => VNode {
    const el: ShallowRef<HTMLElement | null> = shallowRef(null);
    const model = useGridModel();

    // 使用核心 Hook 管理 Item 生命周期
    useGridItem(props as GridItemProps, el);

    const nestedName = computed(() => `${props.id ?? createId()}:nested`);

    const isNested = computed(() => props.children !== undefined);

    const attributes = computed<Record<string, unknown>>(() =>
      Object.fromEntries(
        (Object.entries(GRID_ITEM_ATTRS) as [keyof GridItemProps, string][])
          .filter(([, attr]) => attr !== undefined)
          .map(([key, attr]) => [`gs-${attr}`, (props as GridItemProps)[key]]),
      )
    );

    const renderContent = (): VNode => {
      if (isNested.value) {
        return h(Grid as Component, {
          name: nestedName.value,
          modelValue: props.children as GridItemProps[] | undefined,
          nested: true,
          'onUpdate:modelValue': (value: GridItemProps[]) => {
            if (!props.id) return;
            model.updateItem(props.id, { children: value });
          },
        });
      }

      return h('div', [slots.default ? slots.default() : props.id]);
    };

    return (): VNode =>
      h(
        'div',
        {
          ref: el,
          class: [
            'grid-stack-item',
            'oc-grid-item',
            props.nested ? 'grid-stack-item-nested' : null,
          ],
          ...createAttrs(attributes.value),
        },
        [
          h('div', { class: ['grid-stack-item-content', 'oc-grid-item-content'] }, [
            renderContent(),
          ]),
        ],
      );
  },
});
