export {}

import { createClientFromEnv } from '@opencode/oneapi'
import type { Message } from '@opencode/oneapi'

type Role = 'system' | 'user' | 'assistant'

type Chat = {
  role: Role
  text: string
}

type TodoRequest = {
  requestId?: string
  messages: Chat[]
  lang?: string
  limit?: number
  keyName?: string
}

type TodoItem = {
  id: string
  content: string
  status: 'pending'
  priority: 'high' | 'medium' | 'low'
}

type TodoResponse = {
  name: 'todo'
  time: number
  todos: TodoItem[]
  text?: string
}

function readText(): Promise<string> {
  return new Promise((resolve) => {
    const list: Buffer[] = []
    process.stdin.on('data', (chunk) => list.push(chunk as Buffer))
    process.stdin.on('end', () => resolve(Buffer.concat(list).toString('utf8')))
    process.stdin.resume()
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isRole(value: unknown): value is Role {
  return value === 'system' || value === 'user' || value === 'assistant'
}

function parseMessages(value: unknown): Chat[] | null {
  if (!Array.isArray(value)) return null
  const messages: Chat[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    if (!isRole(item.role)) return null
    if (!isText(item.text)) return null
    messages.push({ role: item.role, text: item.text })
  }
  return messages
}

function parseRequest(value: unknown): TodoRequest | null {
  if (!isRecord(value)) return null
  const direct = parseMessages(value.messages)
  const context =
    !direct && isRecord(value.context) ? parseMessages((value.context as Record<string, unknown>).messages) : null
  const messages = direct ?? context
  if (!messages) return null

  const contextLimit =
    isRecord(value.context) && typeof (value.context as Record<string, unknown>).limit === 'number'
      ? ((value.context as Record<string, unknown>).limit as number)
      : undefined
  const rawLimit = typeof value.limit === 'number' ? value.limit : contextLimit
  const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? Math.max(1, Math.min(20, rawLimit)) : 10

  return {
    requestId: isText(value.requestId) ? value.requestId : undefined,
    messages,
    lang: isText(value.lang) ? value.lang : 'zh',
    limit,
    keyName: isText(value.keyName) ? value.keyName : undefined,
  }
}

function buildPrompt(request: TodoRequest): { promptText: string; messages: Message[] } {
  const limit = request.limit ?? 10
  const promptText =
    'You convert chat into actionable todos.\n' +
    'Return only JSON.\n' +
    'Schema: {\"todos\":[{\"id\":\"t1\",\"content\":\"...\",\"status\":\"pending\",\"priority\":\"high|medium|low\"}]}\n' +
    `Rules: content starts with a verb, <=14 Chinese characters, max ${limit} todos.\n` +
    'No markdown. No extra text.'

  const messages: Message[] = [{ role: 'system', text: promptText }]
  for (const item of request.messages) messages.push({ role: item.role, text: item.text })
  return { promptText, messages }
}

function parseTodos(text: string): TodoItem[] | null {
  const value = text.trim()
  if (!value) return null

  let json: unknown
  try {
    json = JSON.parse(value) as unknown
  } catch {
    return null
  }

  if (!isRecord(json)) return null
  const list = json.todos
  if (!Array.isArray(list)) return null

  const todos: TodoItem[] = []
  for (const item of list) {
    if (!isRecord(item)) return null
    if (!isText(item.id)) return null
    if (!isText(item.content)) return null
    const status = item.status
    if (status !== 'pending') return null
    const priority = item.priority
    if (priority !== 'high' && priority !== 'medium' && priority !== 'low') return null
    todos.push({ id: item.id, content: item.content, status: 'pending', priority })
  }

  return todos
}

async function callModel(request: TodoRequest): Promise<{ provider: string; model: string; text: string }> {
  const mock = typeof process.env.ONEAPI_MOCK === 'string' && process.env.ONEAPI_MOCK.length > 0
  if (mock) {
    return {
      provider: 'mock',
      model: 'mock',
      text: JSON.stringify({
        todos: [
          { id: 't1', content: '整理需求', status: 'pending', priority: 'high' },
          { id: 't2', content: '拆分任务', status: 'pending', priority: 'medium' },
        ],
      }),
    }
  }

  const envClient = createClientFromEnv()
  const prompt = buildPrompt(request)
  const model = envClient.model
  const provider = envClient.provider

  const result = await envClient.client.chat({
    provider,
    keyName: isText(request.keyName) ? request.keyName : undefined,
    model,
    messages: prompt.messages,
  })

  return { provider, model, text: result.text }
}

async function main(): Promise<void> {
  const inputText = await readText()
  const inputData = JSON.parse(inputText || 'null') as unknown
  const request = parseRequest(inputData)

  const time = Date.now()
  if (!request) {
    const output: TodoResponse = { name: 'todo', time, todos: [], text: 'Invalid request' }
    process.stdout.write(JSON.stringify(output) + '\n')
    process.exitCode = 1
    return
  }

  const model = await callModel(request)
  const todos = parseTodos(model.text) ?? []
  const output: TodoResponse = { name: 'todo', time, todos, text: `provider=${model.provider} model=${model.model}` }

  process.stdout.write(JSON.stringify(output) + '\n')
  process.exitCode = todos.length > 0 ? 0 : 1
}

await main()
