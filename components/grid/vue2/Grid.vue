<template>
  <div class="grid-stack">
    <div
      v-for="item in layout"
      :key="item.id"
      class="grid-stack-item"
      :gs-id="item.id"
      :gs-x="item.x"
      :gs-y="item.y"
      :gs-w="item.w"
      :gs-h="item.h"
      :gs-min-w="item.minW"
      :gs-min-h="item.minH"
      :gs-no-resize="item.noResize"
      :gs-no-move="item.noMove"
      :gs-locked="item.locked"
      ref="items"
    >
      <div class="grid-stack-item-content">
        <slot :item="item"></slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue';
import { Grid, GridItem, GridOptions } from '../core';

export default Vue.extend({
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
  data() {
    return {
      grid: null as Grid | null,
    };
  },
  mounted() {
    this.initGrid();
  },
  watch: {
    layout: {
      handler(newLayout) {
        // We sync Core with new layout.
        // Core handles diffing and state update.
        this.$nextTick(() => {
          if (this.grid) {
             // 1. Sync data state
             this.grid.sync(newLayout);
             // 2. Sync DOM (GridStack needs to know about new DOM elements)
             this.makeWidgets();
          }
        });
      },
      deep: true,
    },
    options: {
      handler(newOpts) {
        // Options update usually requires re-init or calling GridStack.setOptions if available
        // For simplicity, we assume options are static for now or handled via specific APIs
      },
      deep: true
    }
  },
  methods: {
    initGrid() {
      const el = this.$el as HTMLElement;
      this.grid = new Grid();
      
      // Initialize core
      this.grid.init(el, this.options);

      // Load initial state
      if (this.layout.length > 0) {
        this.grid.sync(this.layout);
        this.$nextTick(() => {
           this.makeWidgets();
        });
      }

      // Bind events using Core's standard event system
      this.grid.on('change', (nodes: any[]) => {
        // Core emits 'change' when layout changes (drag/drop/resize)
        // We need to update our parent
        const newLayout = this.grid!.getItems();
        this.$emit('change', newLayout);
        this.$emit('update:layout', newLayout);
      });
      
      this.grid.on('added', (nodes: any[]) => {
        this.$emit('added', nodes);
      });

      this.grid.on('removed', (nodes: any[]) => {
        this.$emit('removed', nodes);
      });

      // Forward other events
      ['dragstart', 'dragstop', 'dropped'].forEach(evt => {
        this.grid!.on(evt, (data: any) => {
          this.$emit(evt, data);
        });
      });
    },

    makeWidgets() {
       if (!this.grid) return;
       // We iterate over current DOM items and ensure they are widgets
       const domItems = this.$refs.items as HTMLElement[];
       if (domItems) {
         domItems.forEach(el => {
           this.grid!.make(el);
         });
       }
    }
  },
  beforeDestroy() {
    this.grid?.destroy(false);
  },
});
</script>

<style>
/* Ensure gridstack styles are applied if not loaded globally */
/* We imported css in core, so it should be fine if bundler handles it */
.grid-stack {
  background: #f8f9fa; /* Optional background */
}
.grid-stack-item-content {
  background: white;
  border: 1px solid #ddd;
}
</style>
