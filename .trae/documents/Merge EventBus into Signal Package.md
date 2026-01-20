# 合并 EventBus 到 Signal 包

将 `components/grid/core/event-bus.ts` 中实现的功能增强（支持异步 `MaybePromise`、`once` 方法等）合并到 `packages/signal` 包中，替换原有的 `Signal` 实现，使其成为一个功能更强大的通用事件总线。

## 1. 更新 `packages/signal`

*   **修改 `packages/signal/src/index.ts`**:
    *   引入 `MaybePromise` 类型定义。
    *   更新 `Handler` 和 `WildcardHandler` 类型以支持返回 `MaybePromise<void>`。
    *   更新 `Signal` 类（或重命名为 `EventBus` 并保留 `Signal` 别名以兼容）：
        *   添加 `once` 方法。
        *   更新 `on` 方法返回取消函数 `() => void`。
        *   更新 `emit` 方法处理异步回调（虽然 `emit` 本身通常不等待，但类型定义需允许）。

## 2. 更新 `components/grid`

*   **修改 `components/grid/core/event-bus.ts`**:
    *   移除本地实现。
    *   直接从 `@opencode/signal` 导出 `EventBus` (及相关类型)。
    *   或者如果 `Signal` 包导出名仍为 `Signal`，则在此处进行重命名导出：`export { Signal as EventBus } from '@opencode/signal';`。

## 3. 验证

*   确保 `components/grid` 中的代码（如 `GridEngine`）在使用更新后的 `EventBus` 时无需修改或仅需微调。
*   `GridEngine` 中使用了 `mitt: EventBus<EventEmitt> = new EventBus()`，且依赖 `on` 返回取消函数，这在旧的 `Signal` 实现中是不支持的（旧 `on` 返回 `void`）。新的实现将支持这一点，从而修复潜在的类型不匹配问题。

**步骤**:
1.  重构 `packages/signal/src/index.ts`，采用 `EventBus` 的实现逻辑。
2.  更新 `components/grid/core/event-bus.ts` 为重导出文件。
3.  检查并修复任何类型错误。