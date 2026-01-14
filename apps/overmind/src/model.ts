import { createClientFromEnv, type Message, type Usage } from '@opencode/oneapi'
import type { ChatResponse } from '@opencode/oneapi'

import type { TaskRequest } from './task'

export type ModelResult = {
  provider: string
  model: string
  usage?: Usage
  text: string
  raw?: unknown
}

export async function callModel(request: TaskRequest, messages: Message[]): Promise<ModelResult> {
  const mock = typeof process.env.ONEAPI_MOCK === 'string' && process.env.ONEAPI_MOCK.length > 0
  if (mock) {
    if (request.taskType === 'chat') {
      const context = request.context as Record<string, unknown>
      const messageList = Array.isArray(context.messages) ? context.messages : []
      const limit = typeof context.limit === 'number' && Number.isFinite(context.limit) ? context.limit : undefined

      return {
        provider: request.provider ?? 'mock',
        model: request.model ?? 'mock',
        text: JSON.stringify({ agent: 'todo', input: { messages: messageList, limit, keyName: request.keyName } }),
      }
    }

    return {
      provider: request.provider ?? 'mock',
      model: request.model ?? 'mock',
      text: JSON.stringify({ agent: 'echo', input: request }),
    }
  }

  const envClient = createClientFromEnv()
  const provider = request.provider ?? envClient.provider
  const model = request.model ?? envClient.model

  const result = (await envClient.client.chat({
    provider,
    keyName: request.keyName,
    model,
    messages,
  })) as ChatResponse

  return {
    provider,
    model,
    usage: result.usage,
    text: result.text,
    raw: result.raw,
  }
}
