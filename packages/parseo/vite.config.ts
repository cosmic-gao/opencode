import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: 'examples',
  assetsInclude: ['**/*.vue'],
  resolve: {
    alias: {
      '/src': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
