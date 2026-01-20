import {
  type Component,
  computed,
  defineComponent,
  h,
  isVue2,
  type SetupContext,
  type ShallowRef,
  shallowRef,
  type VNode,
} from 'vue-demi';
import { createId, GRID_ITEM_ATTRS } from '../core';
import { Grid } from './grid';
import { useGridModel } from './grid.context';
import { GridItemProps } from './grid.type';
import type { GridItemProps as GridItemPropsType } from './grid.type';
import { useGridItem } from './use-grid-item';

/**
 * 创建 Vue2/Vue3 兼容的属性对象
 * @param attrs 属性对象
 * @returns Vue2 包装后的 attrs 或 Vue3 直接使用的 attrs
 */
export function createAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  return isVue2 ? { attrs } : attrs;
}

export const GridItem = defineComponent({
  name: 'GridItem',
  props: {
    ...GridItemProps,
    x: { type: Number, default: undefined },
    y: { type: Number, default: undefined },
  },
  setup(props, { slots }: SetupContext): () => VNode {
    const el: ShallowRef<HTMLElement | null> = shallowRef(null);
    const model = useGridModel();

    useGridItem(props as GridItemPropsType, el);

    const nestedName = computed(() => `${props.id ?? createId()}:nested`);

    const isNested = computed(() => props.children !== undefined);

    const attributes = computed<Record<string, unknown>>(() =>
      Object.fromEntries(
        (Object.entries(GRID_ITEM_ATTRS) as [keyof GridItemPropsType, string][])
          .filter(([, attr]) => attr !== undefined)
          .map(([key, attr]) => [`gs-${attr}`, (props as GridItemPropsType)[key]]),
      )
    );

    const renderContent = (): VNode => {
      if (isNested.value) {
        return h(Grid as Component, {
          name: nestedName.value,
          modelValue: props.children as GridItemPropsType[] | undefined,
          nested: true,
          'onUpdate:modelValue': (value: GridItemPropsType[]) => {
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
