# 重构 Vue 2 组件为 Options API 风格

将 `Grid.tsx` 从 Composition API (`setup`) 重构为经典的 Vue 2 Options API 写法，以符合用户对 "Vue 2 写法" 的预期。

1.  **重写 `Grid.tsx`**:
    *   移除 `ref`, `onMounted`, `watch`, `nextTick` 等 Composition API 导入。
    *   保留 `defineComponent` 和 `PropType` (Vue 2.7 支持)。
    *   使用 `data()` 定义响应式数据 (`gridInstance`)。
    *   使用 `mounted()` 生命周期替代 `onMounted`。
    *   使用 `beforeDestroy()` 生命周期替代 `onBeforeUnmount`。
    *   使用 `methods` 定义 `initGrid` 和 `makeWidgets`。
    *   使用 `watch` 选项监听 `layout` 变化。
    *   使用 `render()` 函数进行渲染，将 `ref={rootEl}` 改为 `ref="rootEl"`，`slots.default` 改为 `this.$slots.default`。
    *   将 `emit` 调用改为 `this.$emit`。

2.  **JSX 语法调整**:
    *   `ref` 引用方式调整为字符串形式 (`ref="rootEl"`)，通过 `this.$refs.rootEl` 访问。
    *   插槽访问方式调整为 `this.$scopedSlots.default` (优先) 或 `this.$slots.default`。
        *   注意：GridStack item 内容通常需要作用域插槽来传递 item 数据吗？原代码 `{slots.default && slots.default({ item })}` 使用了作用域插槽。在 Vue 2 中应使用 `this.$scopedSlots.default({ item })`。

## 详细变更

*   `setup()` -> `data()`, `methods`, `lifecycle hooks`.
*   `ref` -> `this.$refs`.
*   `emit` -> `this.$emit`.
*   `slots` -> `this.$scopedSlots` (因为用到了参数传递).

这将确保代码风格完全符合 Vue 2 的经典模式。