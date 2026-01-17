# Graph Package Examples

本目录包含 `@opencode/graph` 核心包的使用示例。

## 内容

- [basic-usage.ts](./basic-usage.ts): 基础完整流程演示
  - 创建图
  - 使用工作区 (Workspace)
  - 应用增量变更 (Delta)
  - 影响分析 (Affected Subgraph)
  - 结构校验 (Validate)

## 运行方式

由于本项目使用 TypeScript，您可以直接查看代码了解 API 用法，或使用 `tsx` 运行示例（推荐，因为它能更好地处理 ESM 模块解析）：

```bash
# 使用 npx 运行
npx tsx examples/basic-usage.ts
``````

## 核心概念说明

1. **Graph (不可变)**: 每次变更都会生成新的 Graph 实例，确保数据安全性。
2. **GraphWorkspace (可变)**: 管理编辑会话，维护增量索引以提高性能。
3. **Delta**: 描述变更的数据结构（JSON 可序列化）。
4. **Lookup**: 提供 O(1) 的图查询能力。
