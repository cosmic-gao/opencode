import {
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  type ShallowRef,
  shallowRef,
  watch,
  onBeforeUnmount
} from "vue-demi";
import type { DragItemOptions, GridEngine } from "../core";
import { GridFactory } from "../core/internal";
import type { GridDragPortalProps } from "./grid.type";

export const GridDragPortal = defineComponent({
  name: "GridDragPortal",
  props: {
    target: { type: String, required: true },
    id: { type: String, default: undefined },
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
    children: { type: Array as PropType<GridDragPortalProps["children"]>, default: undefined },
    data: { type: null as unknown as PropType<unknown>, default: undefined }
  },
  setup(props, { slots }: SetupContext) {
    const el: ShallowRef<HTMLElement | null> = shallowRef(null);
    const grid: ShallowRef<GridEngine | null> = shallowRef(null);

    const setupDrag = async (name: string | undefined): Promise<void> => {
      const dom = el.value;
      if (!name || !dom) return;

      const instance = GridFactory.getInstance();
      grid.value = await instance.waitForGrid(name);
      if (!grid.value) return;

      const { target: _, ...options } = props;
      grid.value.driver.setupDragIn(dom, options as unknown as DragItemOptions<unknown>);
    };

    watch(
      () => props.target,
      (name: string) => {
        void setupDrag(name);
      },
      { immediate: true }
    );

    onBeforeUnmount(() => {
      if (grid.value && el.value) grid.value.driver.destroyDragIn(el.value);
      grid.value = null;
    });

    return () =>
      h(
        "div",
        {
          ref: el,
          class: ["sylas-grid-drag-portal", "grid-drag-portal", "grid-stack-item-content"],
          tabindex: 0
        },
        slots.default?.()
      );
  }
});
