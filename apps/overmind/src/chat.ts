export type Role = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: Role
  text: string
}

export type ChatRequest = {
  requestId?: string
  messages: ChatMessage[]
  limit?: number
  keyName?: string
  provider?: string
  model?: string
}

export type ChatResponse = {
  requestId?: string
  success: boolean
  data?: unknown
  text: string
  error?: string
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

export function parseChat(value: unknown): ChatRequest | null {
  if (!isRecord(value)) return null
  const list = value.messages
  if (!Array.isArray(list)) return null

  const messages: ChatMessage[] = []
  for (const item of list) {
    if (!isRecord(item)) return null
    if (!isRole(item.role)) return null
    if (!isText(item.text)) return null
    messages.push({ role: item.role, text: item.text })
  }

  const limit = typeof value.limit === 'number' && Number.isFinite(value.limit) ? Math.max(1, Math.min(20, value.limit)) : undefined
  const requestId = isText(value.requestId) ? value.requestId : undefined
  const keyName = isText(value.keyName) ? value.keyName : undefined
  const provider = isText(value.provider) ? value.provider : undefined
  const model = isText(value.model) ? value.model : undefined

  return { requestId, messages, limit, keyName, provider, model }
}
