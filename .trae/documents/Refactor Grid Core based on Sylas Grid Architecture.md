# 重构 `components/grid/core`

参考 `e:\sylas-grid\src\core` 的实现，将 `e:\opencode\components\grid\core` 进行全面重构，并保持命名风格一致。

## 1. 结构调整

目标目录结构 `components/grid/core/`：

*   `create-grid.ts`: 工厂函数入口 (`createGrid`)。
*   `create-id.ts`: ID 生成工具。
*   `drag-engine.ts`: 拖拽引擎封装 (`DragEngine`)。
*   `event-bus.ts`: 事件总线 (`EventBus`, `Emitter`)。
*   `grid-engine.ts`: 核心引擎 (`GridEngine`)，管理 GridStack 实例与 Items。
*   `grid-factory.ts`: 全局工厂 (`GridFactory`)，管理多实例。
*   `grid-stack.ts`: GridStack 类型扩展与补丁。
*   `microtask.ts`: 微任务工具。
*   `public-api.ts`: 统一导出。
*   `index.ts`: 导出所有。

## 2. 核心类实现

*   **`GridEngine`** (原 `Grid`):
    *   继承/实现 `GridEngineSpec`。
    *   管理 `GridStack` 实例。
    *   集成 `DragEngine`。
    *   使用 `EventBus` 替代 `Signal` (或者封装 Signal 为 EventBus)。
    *   实现 `addItem`, `removeItem`, `updateItem` 等方法。
    *   实现 `flush` 机制进行批量更新优化。

*   **`DragEngine`**:
    *   封装 GridStack 的 DD (Drag & Drop) 功能。
    *   处理外部拖入 (`setupDragIn`) 和 接受规则 (`setupAccept`)。

*   **`GridFactory`**:
    *   单例模式。
    *   管理 `GridEngine` 实例集合 (`grids`)。
    *   提供 `createGrid`, `getGrid`, `waitForGrid`。

*   **`EventBus`**:
    *   基于 `Signal` 包实现，或者直接复用 `sylas-grid` 的实现（看起来是简单的 Mitt 变体）。为了保持 monorepo 统一，建议使用 `@opencode/signal` 并通过适配器适配接口，或者直接重写为类似实现。
    *   **决策**: 使用 `@opencode/signal` 的 `Signal` 类作为底层，但对外暴露 `EventBus` 接口以保持 API 一致性。

## 3. 迁移与兼容

*   **Hooks**: `useLayout` 和 `useGridStack` 将被废弃，逻辑并入 `GridEngine`。
*   **Vue 适配器**: 需要更新 `components/grid/vue2/Grid.tsx` 以适配新的 `createGrid` / `GridEngine` API。
    *   `new Grid()` -> `createGrid(el, options)`。
    *   `grid.on(...)` -> `grid.on(...)` (API 兼容)。
    *   `grid.sync(...)` -> 需要在 `GridEngine` 中实现类似逻辑或使用 `updateItem` / `load`。

## 4. 执行步骤

1.  **创建基础工具**: `create-id.ts`, `microtask.ts`, `grid-stack.ts` (类型扩展)。
2.  **创建事件总线**: `event-bus.ts`。
3.  **创建引擎**: `grid-engine.ts` (核心逻辑) 和 `drag-engine.ts`。
4.  **创建工厂**: `grid-factory.ts` 和 `create-grid.ts`。
5.  **导出**: `public-api.ts` 和 `index.ts`。
6.  **更新 Vue 组件**: 修改 `components/grid/vue2/Grid.tsx` 使用新 API。
7.  **清理**: 删除旧文件 (`hooks/`, `types.ts` 等)。

## 5. 依赖
*   `nanoid`: 用于 `create-id.ts`。
*   `gridstack`: 核心依赖。

注意：`sylas-grid` 使用了 `nanoid`，需要确认 `package.json` 是否已有或需安装。`@opencode/grid` 的 `package.json` 中目前没有 `nanoid`，需要添加或使用简易实现。鉴于 `create-id.ts` 很简单，可以使用简单的随机 ID 生成替代 `nanoid` 以减少依赖，或者添加依赖。这里建议添加 `nanoid`。

(检查发现 `packages/graph` 有 `nanoid`，monorepo 中可能已有，但最好显式声明依赖)

**Plan**:
1.  安装/确认 `nanoid` 依赖。
2.  按顺序创建 Core 文件。
3.  适配 Vue 组件。
4.  清理旧代码。