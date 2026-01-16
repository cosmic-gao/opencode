<script setup lang="tsx">
import { ref } from 'vue'

// TypeScript Enum
enum Direction {
  Up,
  Down
}

const count = ref(0)
</script>

<template>
  <!-- Main Container -->
  <div class="card">
    <button type="button" @click="count++">count is {{ count }}</button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
  </div>
</template>

<style scoped>
/* Base Styles */
.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}
</style>
