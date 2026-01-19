# 重整目录结构方案

为了实现“层次更清晰、高内聚低耦合”的目标，我建议采用**三层架构**对 `packages/graph` 进行重构。

## 1. 新的目录结构

我们将项目划分为 **内核层 (Core)**、**特性层 (Features)** 和 **应用层 (App/Editor)**。

```text
packages/graph/src/
├── common/               # [通用层] 基础工具
│   └── id.ts             # (原 utils/id.ts)
│
├── core/                 # [内核层] 图引擎的核心，负责数据与状态
│   ├── model/            # (原 model) 纯数据定义 (Node, Edge, Graph)
│   ├── state/            # (原 state) 状态管理 (Store, Registry)
│   └── lookup/           # (原 lookup) 高性能索引 (Lookup, View)
│
├── features/             # [特性层] 基于内核的可插拔能力
│   └── validate/         # (原 validate) 校验框架与规则
│
├── editor/               # [应用层] 面向用户的编辑器入口
│   ├── index.ts          # (原 workspace/index.ts) Workspace 实现
│   └── ...
│
└── index.ts              # 统一导出入口
```

## 2. 设计意图

*   **`core/`**: 这是图引擎的“心脏”。包含了数据模型 (`model`)、运行时状态 (`state`) 和查询视图 (`lookup`)。这一层是自洽的，不依赖上层业务。
*   **`features/`**: 存放扩展功能。`validate` 属于一种特性，未来可以增加 `layout` (自动布局)、`serialize` (高级序列化) 等。
*   **`editor/`**: 这是“胶水层”或“门面层”。它将 Core 和 Features 组装起来，提供给用户一个易用的 `Workspace` 对象。
*   **`common/`**: 存放无业务属性的通用代码。

## 3. 实施步骤

1.  **创建目录**: 建立 `src/common`, `src/core`, `src/features`, `src/editor`。
2.  **文件迁移**:
    *   `src/utils` -> `src/common`
    *   `src/model`, `src/state`, `src/lookup` -> `src/core/`
    *   `src/validate` -> `src/features/validate`
    *   `src/workspace` -> `src/editor`
3.  **引用修复**: 批量更新所有文件中的 `import` 路径（例如 `../../model` 变为 `../../core/model`）。
4.  **入口更新**: 更新 `src/index.ts` 的导出路径。
5.  **验证**: 运行 `tsc` 确保类型检查通过，并运行 `examples/usage.ts` 确保功能正常。

## 4. 兼容性说明

本次重构仅涉及**内部目录结构调整**。
对外暴露的 API（通过 `src/index.ts` 导出）保持不变，因此不会破坏下游依赖。
