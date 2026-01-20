import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';
import vueJsx from '@vitejs/plugin-vue2-jsx';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    vueJsx()
  ],
  root: './demo', // Set root to demo folder
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'gridstack/dist/gridstack.min.css': 'gridstack/dist/gridstack.min.css' 
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
