我理解您的顾虑。将数据管理单独拆分为 `use-grid-data.ts` 可能确实显得颗粒度过细，因为在 `Grid` 组件中，数据状态（modelValue）与引擎状态（Engine）的同步是紧密耦合的核心逻辑。过度拆分反而可能导致 API 传递繁琐，增加认知负担。

**调整后的优化计划：**

我将不再单独创建 `use-grid-data.ts`，而是采取更聚合的策略：

1.  **新建 `use-grid.ts` (核心逻辑聚合)**
    *   **职责**: 统一管理 Grid 的**核心状态与引擎交互**。
    *   **内容**:
        *   **数据管理**: 处理 `modelValue` 的双向绑定、ID 生成与数据合并（原计划 `use-grid-data` 的内容）。
        *   **引擎管理**: 处理 GridStack 实例的生命周期 (`createGrid`/`destroy`) 和事件监听。
        *   **同步机制**: 核心的 `syncFromGrid` 和 `scheduleSync` 逻辑，直接在内部闭环处理数据与引擎的同步，无需在组件层手动编排。
    *   **收益**: 提供一个高内聚的 Hook，组件只需调用 `useGridController(props, emit)` 即可获得完整的 Grid 能力，符合“高内聚”原则。

2.  **新建 `use-grid-item.ts` (子项逻辑)**
    *   **职责**: 管理单个 Grid Item 的生命周期。
    *   **内容**: 保持原计划，封装 Item 的 `add`、`remove`、`update` 和属性监听 (`watch`)。这是父子组件分离的自然边界，适合独立提取。

3.  **重构组件**
    *   **`grid.ts`**: 调用 `useGrid`，聚焦于渲染。
    *   **`grid-item.ts`**: 调用 `useGridItem`，聚焦于渲染。

**调整后的文件结构**：
```text
components/grid/vue/
  ├── composables/
  │   ├── use-grid.ts       (聚合了数据与引擎逻辑)
  │   └── use-grid-item.ts  (子项逻辑)
  ├── grid.ts
  ├── grid-item.ts
  └── ...
```

这个方案在保持 SRP（将逻辑从 UI 组件剥离）的同时，避免了过度碎片化，逻辑更加内聚且易于管理。
