import {
  defineComponent,
  h,
  type PropType,
  type Ref,
  type SetupContext,
  type ShallowRef,
  type VNode,
  computed,
  shallowRef,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  resolveComponent
} from "vue-demi";
import type { GridItem as GridItemInstance, GridItemOptions } from "../core";
import { GRID_ITEM_ATTRS, GridUtils, createId } from "../core";
import { useGrid } from "./grid.context";
import type { GridItemProps } from "./grid.type";
import { GRID_ITEM_KEYS } from "./grid.const";
import { createAttrs } from "./vue";

export const GridItem = defineComponent({
  name: "GridItem",
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
    children: { type: Array as PropType<GridItemOptions[]>, default: undefined }
  },
  setup(props, { slots }: SetupContext): () => VNode {
    const el: ShallowRef<HTMLElement | null> = shallowRef(null);
    const item: Ref<GridItemInstance | null> = ref(null);
    const grid = useGrid();

    const nestedName: Ref<string> = ref(`${props.id ?? createId()}:nested`);

    const isNested = computed(() => !!props.children?.length);

    const attributes = computed<Record<string, unknown>>(() =>
      Object.fromEntries(
        (Object.entries(GRID_ITEM_ATTRS) as [keyof GridItemProps, string][])
          .filter(([, attr]) => attr !== undefined)
          .map(([key, attr]) => [`gs-${attr}`, (props as GridItemProps)[key]])
      )
    );

    watch(
      () => GridUtils.pick(props as GridItemProps, GRID_ITEM_KEYS),
      (options: Partial<GridItemProps>) => {
        if (!el.value || !grid.value) return;
        grid.value.updateItem(el.value, options as GridItemOptions);
      },
      { deep: true }
    );

    watch(
      () => props.noResize,
      (noResize: boolean | undefined) => {
        if (!el.value || !grid.value) return;
        grid.value.gridstack.resizable(el.value, !!noResize);
      }
    );

    watch(
      () => props.noMove,
      (noMove: boolean | undefined) => {
        if (!el.value || !grid.value) return;
        grid.value.gridstack.movable(el.value, !!noMove);
      }
    );

    onMounted(() => {
      if (!el.value || !grid.value) return;
      item.value = grid.value.addItem(el.value, props as GridItemOptions);
    });

    onBeforeUnmount(() => {
      if (!el.value || !grid.value) return;
      grid.value.removeItem(el.value);
      item.value = null;
    });

    const renderContent = (): VNode | VNode[] | undefined => {
      if (!isNested.value) return slots.default?.();
      const GridComponent = resolveComponent("Grid");
      return h(GridComponent, {
        name: nestedName.value,
        modelValue: props.children as GridItemProps[] | undefined,
        nested: true
      });
    };

    return (): VNode =>
      h(
        "div",
        {
          ref: el,
          class: ["grid-stack-item", "sylas-grid-item", props.nested ? "grid-stack-item-nested" : null],
          ...createAttrs(attributes.value)
        },
        [
          h("div", { class: ["grid-stack-item-content", "sylas-grid-item-content"] }, [renderContent()])
        ]
      );
  }
});
