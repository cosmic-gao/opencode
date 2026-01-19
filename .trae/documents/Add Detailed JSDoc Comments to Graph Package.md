我将为 `packages/graph` 目录下的所有核心方法添加详细的中文 JSDoc 注释，严格遵循用户提供的代码规范（包含 `@param`、`@returns`、`@throws` 和 `@example`）。

执行计划如下：

### 1. 模型模块 (Model Module)
**目标文件**: `src/model/node.ts`, `src/model/edge.ts`, `src/model/endpoint.ts`, `src/model/graph.ts` 等
- **注释重点**:
  - 解释数据结构的**不可变性 (Immutable)** 设计。
  - 详解 `fromValue` (反序列化) 和 `toValue` (序列化) 方法。
- **示例**: 提供创建节点、边以及图对象的代码片段。

### 2. 状态模块 (State Module)
**目标文件**: `src/state/store.ts`, `src/state/registry.ts`, `src/state/applier.ts`
- **注释重点**:
  - `Store`: 说明其作为**单一事实源**的角色及查询接口。
  - `Registry`: 解释内部索引与查找机制。
  - `Applier`: 详解补丁 (Patch) 的应用逻辑与回滚 (Undo) 机制。
- **示例**: 演示如何通过 `store.apply()` 修改图状态。

### 3. 查询模块 (Lookup Module)
**目标文件**: `src/lookup/incremental.ts`, `src/lookup/view.ts`
- **注释重点**:
  - 解释**增量更新**与缓存策略。
  - 说明如何利用 Lookup 接口进行高效 (O(1)) 查询。

### 4. 校验模块 (Validate Module)
**目标文件**: `src/validate/validator.ts`, `src/validate/rule.ts`, `src/validate/rules/*.ts`
- **注释重点**:
  - 解释校验器的运行流程。
  - 详解各个校验规则（如 `cardinality`, `flow`）的业务含义。
- **示例**: 展示如何调用校验函数并解析诊断结果。

### 5. 其他模块
- 扫描 `src/workspace` 及 `src/utils`，为公共工具方法补充注释。

我将从 Model 模块开始，逐个文件进行读取和修改，确保每个公共方法都配备详细的中文文档和示例。
