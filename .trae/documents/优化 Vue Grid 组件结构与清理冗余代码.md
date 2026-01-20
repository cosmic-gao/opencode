我将执行以下计划以优化 `components/grid/vue` 并确保 Playground 功能完备：

1.  **代码清理 (`components/grid/vue`)**：
    *   删除 `vue.ts` 中冗余的 `toProps` 和 `render` 函数。
    *   更新 `grid-item.ts`，将 `nestedName` 改为 `computed` 属性，确保 ID 变化时嵌套网格名能正确更新。

2.  **Playground 增强 (`components/grid/playground/main.ts`)**：
    *   目前 Playground **已经包含** 外部拖拽源（`GridDragPortal`）和垃圾桶（`.grid-stack-library-trash`）的演示。
    *   **确认**：垃圾桶使用了正确的类名 `grid-stack-library-trash`，这与 Core 中默认的 `removable` 配置一致，因此无需修改 Core 代码即可生效。
    *   **优化**：虽然 Playground 代码已存在，但我将检查并微调 `Grid` 的配置，确保 `removable` 选项被显式或隐式正确启用（Core 默认已启用，但明确传递配置更佳），并在 `handleDropped` 或日志中增加对删除操作的反馈（如果可能），以便用户更直观地看到效果。

**验证计划**：
*   修改完成后，Playground 将能够演示：
    *   从左侧面板拖拽新组件到右侧网格。
    *   从右侧网格拖拽组件到左侧“垃圾桶”区域进行删除。
    *   操作后的事件日志输出。

无需对 Playground 进行大规模重写，只需确认配置和类名匹配即可。重点在于 Vue 组件库内部的清理和优化。
