## 目标
- `POST /chat` 与 `overmind chat` 不再固定调用 `todo`，而是基于对话内容自动选择合适的 agent，并把结构化输入交给该 agent 执行。

## 现状简述（基于已读代码）
- Overmind 的 `task` 链路已经是“LLM 输出 Plan（agent+input）→ 校验 → 执行 agent”的雏形：[prompt.ts](file:///e:/opencode/apps/overmind/src/prompt.ts)、[checking.ts](file:///e:/opencode/apps/overmind/src/checking.ts)、[agenting.ts](file:///e:/opencode/apps/overmind/src/agenting.ts)。
- 目前 `prompt` 没把“可用 agent 列表”提供给 LLM，因此 LLM 不能可靠地选择 agent。
- `chat` 入口目前是固定 `kernel.run('todo', ...)`：[serve.ts](file:///e:/opencode/apps/overmind/src/serve.ts)、[main.ts](file:///e:/opencode/apps/overmind/src/main.ts)。

## 设计方案（复用 task 微内核链路）
### 1) chat → task 的统一建模
- 保留 `ChatRequest` 作为对话入口，但在 Overmind 内部把它转换成 `TaskRequest`，让 chat 也走 `kernel.task()`。
- 转换规则：
  - `taskType = 'chat'`
  - `userIntent`：从对话中提取（默认取最后一条 user 文本；若无则拼接所有 user）
  - `context = { messages: ChatMessage[], limit? }`
  - 透传模型参数：`provider?/model?/keyName?`（必要时在 ChatRequest 中补齐这几个字段）

### 2) 路由 prompt：把可用 agent 列表喂给模型
- 扩展 Prompt 构建：在 system prompt 中加入“允许的 agent 清单（name + description）”。
- agent 清单来源：Overmind 扫描到的 `KernelContext.agentList`（已有）：[scan.ts](file:///e:/opencode/apps/overmind/src/scan.ts)。
- 输出强约束：模型必须输出 JSON：
  - `{ "agent": "<must be one of allow list>", "input": <json>, "reason"?: "..." }`

### 3) 安全闸门（校验）升级
- 在 `CheckPlugin` 里除了解析 JSON，还要校验：
  - `plan.agent` 必须存在于 allow list（agentList）
  - `plan.input` 必须是 JSON 可序列化（避免循环引用）
- 校验失败：返回 `TaskResponse.success=false`，并提供明确错误。

### 4) 执行策略
- 校验通过后复用现有 `AgentPlugin` 执行：
  - `kernel.run(plan.agent, JSON.stringify(plan.input))`
- 保留当前 `ONEAPI_MOCK=1` 验证模式：mock 输出的 plan 可指定不同 agent 用于测试路由。

## 代码改造点（文件级）
### A. Overmind
- `src/prompt.ts`
  - `buildPrompt()` 改为接收 allow list（或新增 `buildRoutePrompt()`）
- `src/prompting.ts`
  - 在 plugin 内通过 `api.context()` 读取 `agentList`，注入到 prompt
- `src/checking.ts`
  - 增加 allow list 校验（同样通过 `api.context()` 获取 agentList）
- `src/serve.ts`（/chat）
  - 改为：`parseChat()` → 转 `TaskRequest` → `kernel.task()`（不再固定 todo）
- `src/main.ts`（chat CLI）
  - 同步改为 `kernel.task()`，并输出 TaskResponse
- `src/chat.ts`
  - 如需：扩展 `ChatRequest` 增加 `provider/model/keyName`（可选）

### B. 可选增强（第二阶段，可不做）
- 给每个 agent 增加 `schema`（输入字段说明），Overmind 在 prompt 中一并提供，提升模型构造 input 的可靠性。

## 验证
- 类型检查：`tsc --noEmit` 覆盖 `apps/overmind`
- 行为验证：
  - `ONEAPI_MOCK=1` 下让 mock 产出不同 `plan.agent`（如 `todo`、`echo`），确认 Overmind 能路由并执行。
  - 真实模型：提供 agent allow list 后，应稳定选择存在的 agent，否则会被校验拦截。

确认后我会按上述方案把 `/chat` 与 `overmind chat` 改成“对话路由执行”模式，并完成类型检查与 mock 端到端验证。