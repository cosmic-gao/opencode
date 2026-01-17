# 架构重构计划：事务性工作区与可回滚索引

根据您提出的五大原则，我制定了以下重构计划。核心目标是引入严格的事务管理，确保 Graph 的权威性，并实现索引的可回滚机制。

## 1. 核心变更点

### A. 索引层 (`IncrementalLookup`)
**目标**：实现原则 3（索引是可回滚的缓存）。
- **新增事务 API**:
  - `beginTransaction()`: 开启新事务，初始化 Undo 栈。
  - `commit()`: 提交事务，清空 Undo 栈。
  - `rollback()`: 回滚事务，逆序执行 Undo 栈中的反向操作。
- **内部机制**:
  - 在执行 `apply(delta)` 时，自动计算该操作的 `ReverseDelta`（反向变更），并压入当前事务的 Undo 栈。
  - 这确保了索引可以独立于工作区进行回滚。

### B. 变更层 (`Delta`)
**目标**：支持原则 3 和 4（补丁与回滚）。
- **增强 `GraphDelta`**: 确保 Delta 足够表达反向操作。
- **新增 `invertDelta` 工具**:
  - 签名: `invertDelta(delta: GraphDelta, lookup: LookupView): GraphDelta`
  - 功能: 基于当前图状态，生成能够撤销指定 Delta 的反向 Delta（例如，将“删除节点 A”转换为“添加节点 A，且包含 A 的所有原有属性”）。

### C. 工作区层 (`GraphWorkspace`)
**目标**：实现原则 1（Graph 权威性）和原则 2（事务）。
- **引入 `Transaction` 管理**:
  - `apply(delta)` 不再是原子操作，而是通过事务包装。
- **事务流程**:
  1.  **Prepare**: 规范化 Delta (Normalize)。
  2.  **Begin**: 开启 Lookup 事务；计算针对权威数组（Arrays）的反向 Delta。
  3.  **Mutate**: 更新 Lookup；更新权威数组 (`nodes`/`edges`)。
  4.  **Validate** (纯函数): 基于更新后的 Graph 视图执行校验。
  5.  **Commit/Rollback**:
      - 成功: 提交 Lookup 事务，生成新 Graph 快照。
      - 失败: 回滚 Lookup 事务，利用反向 Delta 恢复权威数组，抛出异常。

## 2. 实施步骤

### 第一步：Delta 反转能力 (Foundation)
- 在 `src/delta` 中实现 `invertDelta` 函数。
- 这是实现回滚的基础，需要利用 Lookup 查找被删除元素的完整信息。

### 第二步：事务性索引 (Lookup)
- 修改 `IncrementalLookup`，增加 `transactionStack`。
- 实现 `beginTransaction`, `commit`, `rollback`。
- 确保 `apply` 操作能正确生成并记录反向操作。

### 第三步：工作区事务改造 (Workspace)
- 重构 `GraphWorkspace.apply`。
- 实现“试探性应用（Tentative Apply）”逻辑：先修改，校验失败则全量回滚。

### 第四步：验证与测试
- 编写测试用例验证：
  - 正常提交（Commit）后，Graph 和 Lookup 状态一致。
  - 校验失败（Rollback）后，Graph 和 Lookup 能够完全恢复到变更前状态。

## 3. 设计与原则对应表

| 原则 | 实现方案 |
| :--- | :--- |
| **1. Graph 权威性** | Workspace 仍以 `nodes`/`edges` 数组为真理；Lookup 仅作为加速层，且通过事务与数组保持强一致。 |
| **2. 事务变更** | `apply` 内部封装为 ACID 事务；任何中间失败都会导致原子性回滚。 |
| **3. 可回滚索引** | `IncrementalLookup` 内置 Undo 栈，支持 `rollback()`。 |
| **4. 命令与补丁** | 保持 `GraphDelta` 作为 Patch 的定位；Workspace 负责处理 Intent 并生成 Patch。 |
| **5. 纯函数计算** | 确保 `validate` 和 `affectedSubgraph` 仅依赖传入的 `Graph` 和 `Lookup` 接口。 |
