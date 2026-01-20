<template>
  <div id="app">
    <h1>Grid Demo (Vue 2 + TS)</h1>
    <div class="controls">
      <button @click="addItem">Add Widget</button>
      <button @click="saveLayout">Save Layout</button>
    </div>
    <div class="layout-container">
      <Grid
        :layout="layout"
        :options="gridOptions"
        @change="onChange"
      >
        <template #default="{ item }">
          <div class="widget-card">
            <div class="header">
              <span>{{ item.content }}</span>
              <button @click.stop="removeItem(item.id)">x</button>
            </div>
            <div class="body">
              ID: {{ item.id }}
            </div>
          </div>
        </template>
      </Grid>
    </div>
    <div class="debug">
      <h3>Data View</h3>
      <pre>{{ layout }}</pre>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import Grid from '../vue2/Grid';
import { GridItem } from '../core';

export default Vue.extend({
  components: { Grid },
  data() {
    return {
      layout: [
        { id: '1', x: 0, y: 0, w: 4, h: 2, content: 'Widget 1' },
        { id: '2', x: 4, y: 0, w: 4, h: 4, content: 'Widget 2' },
      ] as any[],
      gridOptions: {
        cellHeight: 80,
        margin: 10,
        minRow: 1,
        float: true,
      }
    };
  },
  methods: {
    addItem() {
      const id = String(Date.now());
      this.layout.push({
        id,
        x: 0,
        y: 0, // GridStack will find free space if autoPosition is true (default behavior if x/y conflict?)
        // Actually best to let GridStack decide. If we pass x=0, y=0 it might overlap or push.
        // We can pass autoPosition: true in item if we want.
        w: 2,
        h: 2,
        content: `Widget ${this.layout.length + 1}`
      });
    },
    removeItem(id: string) {
      this.layout = this.layout.filter(i => i.id !== id);
    },
    onChange(newLayout: GridItem[]) {
      // Merge properties back
      this.layout = newLayout.map(item => {
        const original = this.layout.find(l => l.id === item.id);
        return {
          ...original,
          ...item
        };
      });
    },
    saveLayout() {
      console.log(JSON.stringify(this.layout, null, 2));
      alert('Layout saved to console');
    }
  }
});
</script>

<style>
body {
  font-family: sans-serif;
  padding: 20px;
}
.controls {
  margin-bottom: 20px;
}
.layout-container {
  border: 1px dashed #ccc;
  min-height: 400px;
  margin-bottom: 20px;
}
.widget-card {
  height: 100%;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.header {
  background: #eee;
  padding: 5px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move; /* Indicate draggable */
}
.body {
  padding: 10px;
  flex: 1;
}
.debug {
  background: #f0f0f0;
  padding: 10px;
}
</style>
