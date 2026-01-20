import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  root: './demo', // Set root to demo folder
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
