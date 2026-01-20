import path from "path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const alias = {
    "@": path.resolve(__dirname, "./"),
    "gridstack/dist/gridstack.min.css": "gridstack/dist/gridstack.min.css"
  };

  if (command === "serve") {
    return {
      root: "./playground",
      base: "./",
      resolve: {
        alias
      }
    };
  }

  return {
    resolve: {
      alias
    },
    build: {
      emptyOutDir: true,
      outDir: "dist",
      lib: {
        entry: path.resolve(__dirname, "vue/index.ts"),
        name: "OpencodeGridVue",
        fileName: (format) => `vue.${format}.js`,
        formats: ["es", "cjs"]
      },
      rollupOptions: {
        external: ["vue", "vue-demi", "gridstack", "nanoid", "@opencode/signal"],
        output: {
          globals: {
            vue: "Vue"
          }
        }
      }
    }
  };
});
