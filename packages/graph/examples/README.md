# Graph Package Examples

本目录包含 `@opencode/graph` 核心包的使用示例。

## 内容

- [basic-usage.ts](./basic-usage.ts): 最小闭环（update + patch + validate + impact）
- [apply-patch.ts](./apply-patch.ts): 直接使用 applyPatch 入口
- [rollback.ts](./rollback.ts): 演示校验失败后的事务回滚
- [impact-options.ts](./impact-options.ts): 演示影响分析的 direction/depth 选项
- [custom-impact.ts](./custom-impact.ts): 演示可插拔 ImpactSemantics

## 运行方式

由于本项目使用 TypeScript，您可以直接查看代码了解 API 用法，或使用 `tsx` 运行示例：

```bash
pnpm -w dlx tsx packages/graph/examples/basic-usage.ts
pnpm -w dlx tsx packages/graph/examples/apply-patch.ts
pnpm -w dlx tsx packages/graph/examples/rollback.ts
pnpm -w dlx tsx packages/graph/examples/impact-options.ts
pnpm -w dlx tsx packages/graph/examples/custom-impact.ts
```

## 核心概念说明

1. **Graph (不可变)**: 每次变更都会生成新的 Graph 实例，确保数据安全性。
2. **GraphWorkspace (可变)**: 管理编辑会话，维护增量索引以提高性能。
3. **Patch**: 描述事实层变更的数据结构（新增/移除/替换）。
4. **GraphStore**: 唯一事实源，校验与影响分析默认基于 GraphStore 执行。
