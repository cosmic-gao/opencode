<template>
  <DefaultLayout>
    <section class="space-y-4">
      <Hello msg="首页" />
      <div class="flex items-center gap-3">
        <button class="px-3 py-1 bg-blue-600 text-white rounded" @click="store.inc">+1</button>
        <span>count: {{ store.count }}</span>
      </div>
    </section>
  </DefaultLayout>
</template>
<script setup lang="ts">
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import Hello from '@/components/Hello'
import { useCounterStore } from '@/stores/counter'

const store = useCounterStore()
</script>
