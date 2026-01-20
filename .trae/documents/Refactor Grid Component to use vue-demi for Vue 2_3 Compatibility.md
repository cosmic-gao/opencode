# 使用 `vue-demi` 适配 Vue 2 和 Vue 3

将 `components/grid/vue` 目录下的组件改造为同时支持 Vue 2 和 Vue 3，利用 `vue-demi` 库。

1.  **安装依赖**:
    *   添加 `vue-demi` 到 `dependencies`。
    *   保持 `vue` 为 `peerDependencies` (或开发依赖)。

2.  **重构 `components/grid/vue/grid.tsx`**:
    *   将 `import Vue from 'vue'` 替换为 `import { defineComponent, ref, ... } from 'vue-demi'`。
    *   **放弃 `Vue.extend`**: `vue-demi` 推荐使用 `defineComponent`。虽然之前因为 Vue 2.6.14 的限制使用了 `Vue.extend`，但为了同时兼容 Vue 3，应该切回 `defineComponent`。
    *   **解决 Vue 2.6 类型问题**: 如果 `defineComponent` 在 Vue 2.6 下类型报错，可以通过安装 `@vue/composition-api` (Vue 2.6 需要) 来补充类型，或者接受 `vue-demi` 的垫片。`vue-demi` 会自动处理这些。
    *   **渲染函数兼容**:
        *   Vue 2 `render(h)` vs Vue 3 `render()` (返回 h 函数结果)。
        *   使用 `h` 函数（从 `vue-demi` 导入）编写渲染逻辑，或者使用 `setup()` 返回渲染函数（推荐）。
        *   插槽访问：Vue 2 `this.$scopedSlots` vs Vue 3 `slots`。`vue-demi` 统一暴露 `slots`。
        *   事件触发：Vue 2 `this.$emit` vs Vue 3 `emit`。`setup(props, { emit })` 统一了这点。

3.  **重构策略 (Composition API)**:
    *   为了最大程度兼容，改回 **Composition API** (`setup`)。之前改回 Options API 是为了 Vue 2 风格，但为了 Vue 3 兼容，Composition API 是最佳公约数。
    *   `setup(props, { emit, slots, expose })`:
        *   使用 `ref` 获取 DOM 元素。
        *   `onMounted` / `onBeforeUnmount` 生命周期。
        *   `watch` 监听 layout。
        *   返回渲染函数 `() => h('div', ...)`。

4.  **关于 `h` 函数**:
    *   `vue-demi` 导出的 `h` 在 Vue 2 中行为类似，但参数略有不同（Vue 2 data object vs Vue 3 flat props）。
    *   为了稳健，可以简单的封装或尽量使用兼容写法。
    *   或者保留 JSX，但需要配置构建工具同时支持 Vue 2 JSX 和 Vue 3 JSX（比较麻烦）。
    *   **建议**: 使用 `setup` 返回渲染函数，并使用 `h` 手写渲染逻辑（不使用 JSX），这样能最大程度保证跨版本兼容，无需构建工具特殊配置。

5.  **具体实现步骤**:
    *   添加 `vue-demi`。
    *   重写 `grid.tsx` 为 `grid.ts` (去除 JSX 依赖，改用 `h` 函数)。
    *   使用 `defineComponent` + `setup`。

## 兼容性细节

*   **Vue 2.6**: 需要安装 `@vue/composition-api` 并在入口处 `Vue.use(CompositionAPI)`。`vue-demi` 会尝试自动切换。
*   **Vue 2.7**: 内置 Composition API，无需额外插件。
*   **Vue 3**: 原生支持。

考虑到当前环境是 Vue 2.6.14 (根据 package.json)，我们需要提示用户可能需要 `@vue/composition-api`。

**计划**:
1.  添加 `vue-demi`。
2.  重写 `grid.tsx` -> `grid.ts`，使用 `defineComponent`, `h`, `ref`, `onMounted` 等。
3.  确保插槽和事件在两版中都能工作。

**注意**: 原文件是 `grid.tsx`，如果用户坚持要 JSX，那么配置会很复杂（Vue 2/3 JSX 转换不同）。改为纯 `h` 函数是库作者常用的兼容手段。

**确认**: 用户之前要求 "Vue 2 写法"，现在要求 "vue-demi 兼容 Vue 2/3"。这两个需求在技术实现上是冲突的（Options API vs Composition API，Template/JSX vs h函数）。鉴于 "兼容 Vue 2 和 Vue 3" 是更高级的目标，我将采用 **Composition API + h 函数** 的方案，这是业界标准做法。

**修正**: `components/grid/package.json` 显示 `vite` 和 `@vitejs/plugin-vue2-jsx`。如果改为 `vue-demi`，可能需要调整构建配置。但作为一个库组件，源码层面的兼容最重要。

**Plan**:
1.  Install `vue-demi`.
2.  Refactor `grid.tsx` to `grid.ts` using `defineComponent` and `h`.
3.  Remove JSX specific code to avoid compilation issues across versions.