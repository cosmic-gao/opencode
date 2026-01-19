# 架构性能优化计划 (无兼容性包袱版)

既然不需要保留兼容性，我们将进行彻底的 **Iterator 化重构**，以彻底消除核心路径上的数组分配开销。

## 目标
将 `Registry` 中所有返回实体集合的方法从 `Array<T>` 重构为 `IterableIterator<T>`，实现**零内存分配 (Zero-Allocation)** 的遍历。

## 实施步骤

### 1. 重构 Registry核心 (`src/state/registry.ts`)
直接修改以下方法签名和实现，使用 Generator (`function*`) 或原生 Iterator：

- **全量访问器**:
  - `get nodes()`: `Node[]` -> `IterableIterator<Node>` (直接返回 `this._nodes.values()`)
  - `get edges()`: `Edge[]` -> `IterableIterator<Edge>`
  - `get endpoints()`: `Endpoint[]` -> `IterableIterator<Endpoint>`

- **关系访问器**:
  - `outgoing(nodeId)`: `Edge[]` -> `IterableIterator<Edge>`
  - `incoming(nodeId)`: `Edge[]` -> `IterableIterator<Edge>`
  - `inputs(nodeId)`: `Endpoint[]` -> `IterableIterator<Endpoint>`
  - `outputs(nodeId)`: `Endpoint[]` -> `IterableIterator<Endpoint>`

**代码变更示例**:
```typescript
// Before
public outgoing(nodeId: string): Edge[] {
  return (this.nodeOutgoing.get(nodeId) || [])
    .map(id => this.edges.get(id))
    .filter(isDefined);
}

// After
public *outgoing(nodeId: string): IterableIterator<Edge> {
  const edgeIds = this.nodeOutgoing.get(nodeId);
  if (edgeIds) {
    for (const id of edgeIds) {
      const edge = this.edges.get(id);
      if (edge) yield edge;
    }
  }
}
```

### 2. 适配调用方 (Call Sites Update)
由于不再返回数组，需要修改所有调用处的代码：

- **`src/state/store.ts`**:
  - 快照生成逻辑 (`snapshot`) 可能需要 `Array.from()` 将 Iterator 转回数组以匹配 Model 定义。
- **`src/validate/**/*.ts`**:
  - 验证规则大量使用了 `.filter()`, `.forEach()`, `.length`。
  - 将链式调用改为高效的 `for (const item of ...)` 循环。
  - 对于需要计数的场景（如 `length`），改为手动计数或新增 `count*` 方法（如需）。
- **`src/lookup/**/*.ts`**:
  - 适配 Iterator 遍历。

### 3. 验证
- 运行全量构建和测试，确保重构未破坏现有逻辑。

此方案将最大程度降低 GC 压力，显著提升复杂图操作的运行时性能。
