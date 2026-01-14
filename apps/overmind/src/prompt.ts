import type { Message } from '@opencode/oneapi'
import type { TaskRequest } from './task'

export type PromptResult = {
  promptText: string
  messages: Message[]
}

export type AgentInfo = {
  name: string
  description?: string
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function buildPrompt(request: TaskRequest, agents: readonly AgentInfo[]): PromptResult {
  const allow = agents.map((agent) => ({ name: agent.name, description: agent.description ?? '' }))
  const promptText =
    'You are a decision engine.\n' +
    'Return only a single JSON object with fields:\n' +
    '{\"agent\":\"string\",\"input\":object|array|string|number|boolean|null,\"reason\":\"string?\"}\n' +
    'Allowed agents:\n' +
    toJson(allow) +
    '\n' +
    'No markdown. No extra text.'

  const messages: Message[] = [
    { role: 'system', text: promptText },
    {
      role: 'user',
      text: toJson({
        requestId: request.requestId,
        taskType: request.taskType,
        userIntent: request.userIntent,
        context: request.context,
        constraints: request.constraints ?? {},
      }),
    },
  ]

  return { promptText, messages }
}
