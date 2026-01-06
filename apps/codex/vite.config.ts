import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import jsx from '@vitejs/plugin-vue-jsx'
import tailwind from '@tailwindcss/vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [vue(), jsx(), tailwind()],
  resolve: {
    alias: {
      '@': r('./src')
    }
  }
})
