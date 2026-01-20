# 新建包 `packages/events`
1.  **初始化包**:
    *   创建 `packages/events` 目录及 `package.json` (`@opencode/events`)。
    *   配置 `tsconfig.json`。
    *   创建 `src/index.ts`，实现基于 `mitt` 的事件总线 (`on`, `off`, `emit`, `all`)。

# 更新 `components/grid`
## 依赖与配置升级
1.  **更新依赖**:
    *   升级 `gridstack` (`^12.4.2`) 和 `vite` (latest)。
    *   添加 `@opencode/events` 和 `@vitejs/plugin-vue2-jsx`。
2.  **配置更新**:
    *   修改 `vite.config.ts` 启用 `vueJsx`。

## Core 层重构 (拆分 Layout 与 Widget)
1.  **拆分逻辑**:
    *   **`Layout` 模块**: 负责纯数据状态管理。
        *   管理 `items` 数组 (x, y, w, h 等属性)。
        *   处理 `sync` (数据同步)、`load` (加载数据)、`getItems`。
        *   触发数据变更事件。
    *   **`Widget` 模块**: 负责 GridStack 实例与 DOM 交互。
        *   封装 `GridStack.init`。
        *   处理 `make` (DOM 转 Widget)、`add/remove` (DOM 操作)。
        *   监听 GridStack 原生事件并转发。
    *   **`Grid` 主类**:
        *   组合 `Layout` 和 `Widget`。
        *   使用 `@opencode/events` 作为统一事件总线。
        *   对外暴露统一 API。

## Vue 2 适配层 (TSX)
1.  **重写 `vue2/Grid.tsx`**:
    *   基于 `defineComponent` 和 TSX 实现。
    *   对接重构后的 `Grid` Core 类。
    *   实现渲染逻辑与生命周期管理。
2.  **清理**:
    *   删除 `vue2/Grid.vue`。
