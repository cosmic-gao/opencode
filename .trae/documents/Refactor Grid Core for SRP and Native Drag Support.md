我将按照单一职责原则（SRP）优化 `components/grid/core` 模块，移除不必要的逻辑，并确保支持外部拖拽（drag-in）和拖拽删除（drag-to-remove）功能。

**计划详情：**

1. **重构** **`DragEngine`** **(`drag-engine.ts`)**:

   * **移除冗余逻辑**: 删除手动实现的 `drop`、`dropout` 和 `accept` 逻辑（包括 `handleDrop`、`handleDropout`、`setupAccept`、`setupDropEvents`）。这些功能现在可以通过 `GridStack` 原生的 `acceptWidgets`、`dragIn` 和 `removable` 配置直接支持。

   * **聚焦职责**: 将 `DragEngine` 的职责收敛为仅负责配置**外部**拖拽源（"Drag In" 功能）。

   * **简化代码**: 仅保留 `setupDragIn` 和 `destroyDragIn` 方法。

2. **重构** **`GridEngine`** **(`grid-engine.ts`)**:

   * **移除状态重复**: 移除内部维护的 `items` Map 和 `GridItem` 包装缓存。`GridEngine` 将直接依赖底层的 `GridStack` 实例作为单一事实来源（Single Source of Truth）。

   * **简化 CRUD 操作**: 重写 `addItem`、`removeItem` 和 `updateItem` 方法，使其直接委托给 `GridStack` 的对应方法，并在需要时动态构建返回值。

   * **配置优化**: 确保 `dragIn` 和 `removable` 配置项正确传递给 `GridStack` 初始化过程，以启用原生的拖拽支持。

3. **清理代码**:

   * **删除** **`gridstack-adapter.ts`**: 该文件包含对 GridStack 内部方法的 Hack 调用（如 `_leave`、`_removeDD`），在移除 `DragEngine` 的手动 Drop 处理后，该文件不再需要。

4. **更新** **`public-api.ts`**:

   * 确保导出所有核心模块，满足“导出所有”的需求。

**验证计划：**

* 检查 `GridEngine` 初始化逻辑是否正确。

* 确认 `addItem` 等方法的重构不破坏原有接口签名。

* 确保所有文件引用和依赖关系正确，无编译错误。

