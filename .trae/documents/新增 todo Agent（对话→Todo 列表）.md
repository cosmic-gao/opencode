## 目标
- 新增一个 Agent：读取对话（messages）并输出结构化 todo 列表。
- Agent 只做一件事：把输入对话转成 todo（不负责执行/调度）。

## Agent 规格（输入/输出）
### 输入（stdin JSON）
- `TodoRequest`
  - `requestId?: string`
  - `messages: { role: 'system'|'user'|'assistant'; text: string }[]`
  - `lang?: string`（默认 `zh`）
  - `limit?: number`（默认 10）

### 输出（stdout JSON）
- `TodoResponse`
  - `name: 'todo'`
  - `time: number`
  - `todos: { id: string; content: string; status: 'pending'; priority: 'high'|'medium'|'low' }[]`
  - `text?: string`（可选，人类可读摘要）

## 目录与文件（单词化）
- `agents/todo/agent.json`
- `agents/todo/package.json`（bun 运行：`dev: bun src/main.ts`）
- `agents/todo/tsconfig.json`
- `agents/todo/src/main.ts`

## 实现方案（微内核/单一职责拆分，文件内用小函数）
- `readText()`：读取 stdin
- `parseRequest()`：解析并校验输入（最小 type guard）
- `buildPrompt()`：构建强约束 prompt（只允许输出 JSON）
- `callModel()`：通过 `@opencode/oneapi` 调 LLM（支持 `ONEAPI_*` 多 key；支持 `ONEAPI_MOCK=1` 直接生成示例 todo）
- `parseTodo()`：解析/校验模型 JSON 输出（保证字段完整、命名完整、1-2 词）
- `writeJson()`：输出标准 JSON

## Prompt 约束（关键点）
- 强制模型“只输出一个 JSON 对象”，字段固定：
  - `{ "todos": [ { "id": "...", "content": "...", "status": "pending", "priority": "high|medium|low" } ] }`
- 规则：
  - `content` 动词开头，≤14 个字
  - `id` 使用短字符串（例如 `t1/t2`）
  - 默认 `status=pending`
  - 限制 todo 数量为 `limit`

## 验证
- `pnpm -w exec tsc -p agents/todo/tsconfig.json --noEmit`
- 运行：
  - `ONEAPI_MOCK=1 pnpm --filter @opencode/agent-todo dev -- --json '{...}'`（或 stdin）
  - 使用一段对话样例验证输出 todos 可被 Overmind 解析。

确认后我将创建 `agents/todo` 并把类型检查与运行验证跑通。