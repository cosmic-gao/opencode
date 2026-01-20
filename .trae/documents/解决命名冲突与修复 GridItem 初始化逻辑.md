我将执行以下计划来整体优化并纠正 `components/grid/vue` 模块中的错误。

**计划详情：**

1.  **解决命名冲突 (Critical Fix)**
    *   修改 `grid.context.ts`：将导出的 `useGrid` 函数重命名为 **`useGridContext`**，以避免与 `use-grid.ts` 中的同名 Hook 冲突。
    *   更新所有引用：
        *   `grid-item.ts`：更新导入为 `useGridContext`。
        *   `use-grid-item.ts`：更新导入为 `useGridContext`。
        *   `index.ts`：确保导出的是重命名后的版本。

2.  **修复 `use-grid-item.ts` 逻辑与清理**
    *   **修复初始化竞态**：子组件 `onMounted` 早于父组件执行，导致 `grid` 实例为 null。
        *   解决方案：使用 `watch` 监听 `grid` 实例的变化。一旦 `grid` 就绪，再执行初始化逻辑。
        *   逻辑细化：如果 `grid` 已经初始化（动态添加的情况），直接执行；如果是初始加载，等待 `grid` 变为非空。同时，对于初始渲染的元素，GridStack 的 `init` 会自动处理 DOM，我们需要区分是“通过 API 添加”还是“绑定现有 DOM”。鉴于 Vue 渲染流，这里统一使用 `makeWidget` 或让 `addItem` 能够智能处理（Core 层的 `addItem` 实际上包含 `createItem` 和 `addWidget`，对于已存在的 DOM 可能需要调整策略，或者依靠 GridStack 的去重机制）。*修正策略：* 最稳妥的方式是：如果元素已经在 DOM 中（Vue 渲染的），调用 GridStack 的 `makeWidget` 可能是更好的选择，或者让 Core 的 `addItem` 处理。目前的 Core `addItem` 会调用 `addWidget`。
        *   **最终方案**：在 `useGridItem` 中，使用 `watch(() => grid.value, ...)` 来触发初始化。
    *   **清理**：移除未使用的 `computed` 导入。
    *   **类型优化**：移除 `props as GridItemProps` 等冗余断言。

3.  **清理 `use-grid.ts`**
    *   移除未使用的 `GridItemOptions` 导入。

4.  **验证**
    *   确保 Playground 运行正常（需要检查 Playground 是否需要更新引用）。

**文件变更清单**：
*   `grid.context.ts` (Rename export)
*   `grid-item.ts` (Update import)
*   `composables/use-grid-item.ts` (Fix logic, update import, cleanup)
*   `composables/use-grid.ts` (Cleanup)
*   `index.ts` (Verify exports)

这个计划将彻底解决命名冲突导致的潜在运行时错误，并修复子组件无法正确获取 Grid 实例的问题。
