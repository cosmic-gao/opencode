import { defineComponent, PropType, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Grid, GridItem, GridOptions } from '../core';

export default defineComponent({
  name: 'Grid',
  props: {
    layout: {
      type: Array as PropType<GridItem[]>,
      required: true,
    },
    options: {
      type: Object as PropType<GridOptions>,
      default: () => ({}),
    },
  },
  emits: ['change', 'added', 'removed', 'update:layout', 'dragstart', 'dragstop', 'dropped', 'resizestart', 'resizestop'],
  setup(props, { emit, slots }) {
    const gridRef = ref<Grid | null>(null);
    const rootEl = ref<HTMLElement | null>(null);

    const makeWidgets = () => {
       if (!gridRef.value) return;
       if (rootEl.value) {
          const items = rootEl.value.querySelectorAll('.grid-stack-item');
          items.forEach(el => {
             gridRef.value!.make(el as HTMLElement);
          });
       }
    };

    const initGrid = () => {
       if (!rootEl.value) return;
       gridRef.value = new Grid();
       gridRef.value.init(rootEl.value, props.options);
       
       if (props.layout.length > 0) {
           gridRef.value.sync(props.layout);
           nextTick(() => {
               makeWidgets();
           });
       }
       
       // Bind events
       gridRef.value.on('change', (nodes: any) => {
           const newLayout = gridRef.value!.getItems();
           emit('change', newLayout);
           emit('update:layout', newLayout);
       });
       
       gridRef.value.on('added', (nodes: any) => emit('added', nodes));
       gridRef.value.on('removed', (nodes: any) => emit('removed', nodes));
       
       // Forward others
       ['dragstart', 'dragstop', 'dropped', 'resizestart', 'resizestop'].forEach(evt => {
           gridRef.value!.on(evt, (data: any) => emit(evt, data));
       });
    };

    onMounted(() => {
        initGrid();
    });

    onBeforeUnmount(() => {
        gridRef.value?.destroy(false);
    });

    watch(() => props.layout, (newLayout) => {
        nextTick(() => {
            if (gridRef.value) {
                gridRef.value.sync(newLayout);
                makeWidgets();
            }
        });
    }, { deep: true });

    return () => (
      <div class="grid-stack" ref={rootEl}>
        {props.layout.map(item => (
            <div
                key={item.id}
                class="grid-stack-item"
                // @ts-ignore
                gs-id={item.id}
                gs-x={item.x}
                gs-y={item.y}
                gs-w={item.w}
                gs-h={item.h}
                gs-min-w={item.minW}
                gs-min-h={item.minH}
                gs-no-resize={item.noResize}
                gs-no-move={item.noMove}
                gs-locked={item.locked}
            >
                <div class="grid-stack-item-content">
                    {slots.default && slots.default({ item })}
                </div>
            </div>
        ))}
      </div>
    );
  }
});
