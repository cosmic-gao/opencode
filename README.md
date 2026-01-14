# OpenCode（monorepo）

本仓库是一个以 monorepo 组织的代码库，包含：

- `apps/isolate`：安全沙箱代码执行引擎（Deno + Hono + Worker）
- `apps/codex`：前端应用（Vue 3 + Vite）
- `packages/plugable`：通用插件系统（Pipeline/Middleware 模型）
- `configs/tsconfig`：共享 TypeScript 配置预设

## 文档

- [架构总览](docs/ARCHITECTURE.md)
- `apps/isolate/README.md`：isolate 的详细使用、API、工具与权限说明
- `packages/plugable/README.md`：plugable 的设计与 API 说明
- `configs/tsconfig/README.md`：tsconfig 预设说明
