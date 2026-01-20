# Core 重构与 Vue 2 适配层规范化

## 1. Core 重构：采用 Hook 模式

将核心逻辑重构为 Hook 组合模式，保持纯 TypeScript 实现，零 Vue 依赖。

*   **新建 `components/grid/core/hooks/`**:
    *   `useLayout.ts`: 纯数据状态管理 (CRUD)。
    *   `useGridStack.ts`: GridStack 实例封装与事件桥接。
*   **重构 `components/grid/core/index.ts`**:
    *   保留 `Grid` 类作为 API 门面，内部组合 `useLayout` 和 `useGridStack`。
    *   API 保持不变，确保兼容性。
*   **清理**:
    *   删除 `layout.ts` 和 `widget.ts`。

## 2. Vue 2 适配层规范化

按照要求，统一使用 `index.ts` 导出 Vue 2 适配器内容。

*   **新建 `components/grid/vue2/index.ts`**:
    *   导出 Grid 组件：`export { default as Grid } from './Grid';`
    *   确保外部可以通过导入 `vue2` 目录直接获取组件。

## 验证

*   确保 `core` 重构后 `Grid` 类 API 与之前一致。
*   确保 `vue2` 目录结构符合新的导出规范。