收到，明确执行您的要求。

**计划详情：**

1.  **更新 `grid.type.ts`**
    *   在文件中定义并导出常量 **`GridItemProps`**（注意：这将与现有的 `interface GridItemProps` 同名，利用 TypeScript 的值与类型合并特性，或者我需要处理一下现有的 Interface 命名以避免冲突/混淆。查看代码发现 `interface GridItemProps` 已经被导出。为了严格遵循您的指令 "名字就叫做 GridItemProps"，我将把 **Props 定义对象** 命名为 `GridItemProps`。
    *   *处理冲突*：由于不能同时 `export interface GridItemProps` 和 `export const GridItemProps`（虽然 TS 允许，但在作为值使用时可能会有 IDE 提示干扰，或者在某些构建工具下有问题），且为了保持语义清晰，我将检查是否需要重命名原有的 Interface，或者直接使用同名导出（如果环境支持）。
    *   *更正*：通常 Vue 项目中，类型叫 `GridItemProps`，Props 定义对象叫 `gridItemProps`。既然您坚持大写，我将**移除**原有的 `interface GridItemProps`（或者将其重命名，例如 `GridItemOptions` 已存在），让 `GridItemProps` 专指这个 Props 定义对象？
    *   *不，通常 Interface 是必须的*。
    *   **最终策略**：我将把公共 Props 定义对象命名为 **`GridItemProps`**。如果与 Interface 冲突，我会将 Interface 重命名为 `GridItemPropsType` 并导出别名，或者直接让两者共存（如果是 .ts 文件，通常允许 Value 和 Type 同名）。
    *   **查看现有代码**：`grid.type.ts` 中已有 `export interface GridItemProps extends GridItemOptions ...`。
    *   **执行方案**：我将保留 Interface `GridItemProps`，并新增导出常量 `GridItemProps`。TypeScript 允许同名的 Interface 和 Const 导出（Declaration Merging）。

2.  **重构 `grid-item.ts`**
    *   引入 `GridItemProps`（作为值）。
    *   使用 `...GridItemProps` 展开属性。

3.  **重构 `grid-drag-portal.ts`**
    *   引入 `GridItemProps`（作为值）。
    *   使用 `...GridItemProps` 展开属性。

**文件变更清单**：
*   `e:\opencode\components\grid\vue\grid.type.ts`
*   `e:\opencode\components\grid\vue\grid-item.ts`
*   `e:\opencode\components\grid\vue\grid-drag-portal.ts`
