## 设计原则（强约束）
- 命名洁癖：方法名/变量名/TS 类型名尽量 1 个单词，最多 2 个单词。
- 单词完整性：优先使用完整单词，避免缩写（例如用 `Request/Response/Message/Provider/Plugin`，不使用 `Req/Res/Msg/Prov/Plug`）。
- 微内核：核心只做“协议 + 生命周期 + 扩展点”，能力通过插件/适配器挂载。
- 单一原则：扫描/解析/执行/协议/适配器拆分文件，各自只负责一件事。
- 抽象复用：通用逻辑下沉到 `oneapi` 或 `overmind` 的 core 层，不在 agent 内复制。

## 需求对齐
- `agents/`：所有 Agent（Node 生态），使用 **Bun** 启动运行。
- `apps/overmind`：用于管理 Agent 的项目，名字固定 Overmind。
- `packages/oneapi`：各大模型标准包名固定 oneapi。

## 总体方案（Bun + 微内核）
- Agent：Bun 直接执行 TypeScript。
- Overmind：Bun CLI + 微内核插件体系（复用现有 `@opencode/plugable`）。
- oneapi：微内核 + provider 适配器（先落地 OpenAI-compatible）。

## 1) Workspace 调整
- 修改 `pnpm-workspace.yaml`：增加 `agents/*`。
- 每个新增项目提供 `dev`（与需要时的 `build`）脚本，兼容 turbo。

## 2) 新建 oneapi：`packages/oneapi`（包名建议 `@opencode/oneapi`）
### 2.1 微内核分层
- Core：协议与稳定抽象
  - 类型：`Message`, `Role`, `ChatRequest`, `ChatResponse`, `Usage`, `OneapiError`
  - 接口：`Provider`
  - 门面：`Client`
- Providers：适配器实现
  - `OpenaiProvider`：OpenAI-compatible provider

### 2.2 文件结构（文件名单词化）
- `src/index.ts`
- `src/types.ts`（只放类型）
- `src/client.ts`（只放 Client）
- `src/openai.ts`（只放 OpenAI-compatible provider）

### 2.3 接口草图（命名 ≤2 词，完整单词）
- `type Message = { role: Role; text: string }`
- `type ChatRequest = { messages: Message[]; model: string; temperature?: number }`
- `type ChatResponse = { text: string; usage?: Usage; raw?: unknown }`
- `interface Provider { chat(request: ChatRequest): Promise<ChatResponse> }`
- `class Client { constructor(provider: Provider) chat(request: ChatRequest): Promise<ChatResponse> }`
- 环境变量（完整单词）：`ONEAPI_BASE_URL`, `ONEAPI_API_KEY`, `ONEAPI_MODEL`。

## 3) 新建 Overmind：`apps/overmind`（包名建议 `@opencode/overmind`）
### 3.1 微内核架构（复用 plugable）
- Kernel：定义 hooks（扩展点）与 context（运行态）
  - hooks：`onScan`, `onList`, `onRun`
  - context：`rootPath`, `env`, `logger`
- Plugins：
  - `ScanPlugin`：扫描 agents 目录并产出 `Agent[]`
  - `RunPlugin`：用 Bun 子进程运行 agent
  - `FormatPlugin`：统一输入输出协议（stdin JSON / stdout JSON）

### 3.2 文件结构（文件名单词化）
- `src/main.ts`（CLI 入口）
- `src/kernel.ts`（hooks/context 组装）
- `src/scan.ts`（只做扫描）
- `src/load.ts`（只做 manifest 解析）
- `src/run.ts`（只做 spawn/pipe）
- `src/types.ts`（只放类型：`Agent`, `AgentSpec`, `RunRequest`, `RunResponse`）

### 3.3 CLI（命令与函数名简短且完整）
- `overmind list`
- `overmind run <name> --json '{...}'`（或从 stdin 读取）

## 4) Agent 项目模板：`agents/<name>`（Bun）
### 4.1 结构与协议
- `src/main.ts`：单一职责（解析输入 → 执行业务 → 输出 JSON）
- 推荐 `agent.json`：`name`, `description`, `entry`
- 输入：stdin JSON
- 输出：stdout JSON

### 4.2 示例 agent（验收用）
- `agents/echo`：回显输入（验证 Overmind 扫描/运行链路）。
- （可选）`agents/chat`：使用 oneapi 调用一次 chat（只读 env，不内置 key）。

## 5) 验证
- workspace：`pnpm -w -r run dev`（确保 Overmind 与示例 agent 可启动）。
- `overmind list`：能输出 `echo`。
- `overmind run echo`：输入 JSON 得到结构化输出。

确认后我将按以上微内核分层与命名规范创建目录/文件，并把 Overmind + oneapi + echo agent 跑通。