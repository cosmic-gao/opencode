## 增补需求（你新增的点）
- oneapi 需要支持“不同大模型 key”（按 provider / model / keyName 选择不同密钥）。

## 设计原则（保持不变）
- 微内核 + 单一职责：oneapi 只做模型访问与标准化；Overmind 做编排与安全闸门；Agent 只执行。
- 命名：完整单词，尽量 1 词，最多 2 词。

## 1. oneapi：多 Key 支持设计
### 1.1 目标
- 同一套 oneapi API，支持多 provider、多 model，并能按规则选择不同 key。
- key 选择逻辑可替换（未来可接 KMS/DB），第一版先用 env。

### 1.2 核心抽象（微内核）
- `KeyStore`：只负责“按请求查找 key”。
  - `get(request): string | undefined`
- `KeyRequest`：只包含 key 选择所需字段。
  - `provider?: string`
  - `model?: string`
  - `keyName?: string`

### 1.3 默认实现：`EnvKeyStore`
- 读取环境变量（完整字段名）：
  - `ONEAPI_API_KEY`（默认 key）
  - `ONEAPI_API_KEY_<PROVIDER>`（按 provider 覆盖）
  - `ONEAPI_API_KEY_<MODEL>`（按 model 覆盖）
  - `ONEAPI_API_KEY_<KEYNAME>`（按 keyName 选择）
- 优先级（更具体者优先）：
  1) `keyName`
  2) `model`
  3) `provider`
  4) default

### 1.4 oneapi 对外 API 调整
- `ChatRequest` 增加可选字段（不影响现有用法）：
  - `provider?: string`
  - `keyName?: string`
- `OpenaiProvider` 的 `apiKey` 改为可选：
  - 若 `apiKey` 未传，则从 `KeyStore.get({provider, model, keyName})` 获取。
- 提供工厂：
  - `createKeyStoreFromEnv()`
  - `createClientFromEnv()`：读取 `ONEAPI_BASE_URL/ONEAPI_MODEL` + `EnvKeyStore`

### 1.5 文件结构（单词化）
- `packages/oneapi/src/key.ts`：KeyStore + EnvKeyStore
- `packages/oneapi/src/env.ts`：createClientFromEnv
- `packages/oneapi/src/openai.ts`：改造为支持 KeyStore

## 2. Overmind：标准化 API → oneapi → 校验 → Agent
（主体方案不变，仅把“provider/model/keyName”纳入 TaskRequest 和模型调用）

### 2.1 TaskRequest（增加可选模型选择字段）
- `TaskRequest`
  - `requestId`
  - `taskType`
  - `userIntent`
  - `context`
  - `constraints?`
  - `provider?`（例如 `openai` / `deepseek` / `qwen`）
  - `model?`（例如 `gpt-4o-mini` / `deepseek-chat`）
  - `keyName?`（例如 `prod` / `test` / `teamA`）

### 2.2 Prompt / Check / Agent 流程
- LLM 输出仍然必须是 JSON `Plan`：`agent` + `input` + `reason?`
- Overmind 校验通过后，调用对应 Agent（bun 子进程），并汇总 TaskResponse。

## 3. 落地步骤（实现顺序）
1) oneapi：引入 `KeyStore/EnvKeyStore`，并在 OpenAI-compatible provider 中接入。
2) oneapi：补 `createClientFromEnv()`，把多 key 选择贯穿到 `chat()`。
3) Overmind：新增 TaskContext hooks 链路（onInput/onPrompt/onModel/onCheck/onAgent/onOutput）。
4) Overmind：新增 Bun HTTP `POST /task` 与 CLI `task --json`，走同一链路。
5) 验证：
   - tsc noEmit
   - 用 `echo` agent 跑通完整链路
   - 用不同 `ONEAPI_API_KEY_*` 验证 key 选择优先级

确认后我会按以上改造 oneapi（多 key）并把 Overmind 的标准化 API 链路落地到代码。