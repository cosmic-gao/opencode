export type Role = 'system' | 'user' | 'assistant'

export type Message = {
  role: Role
  text: string
}

export type Usage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type ChatRequest = {
  messages: readonly Message[]
  model: string
  temperature?: number
  maxTokens?: number
}

export type ChatResponse = {
  text: string
  usage?: Usage
  raw?: unknown
}

export interface Provider {
  chat: (request: ChatRequest) => Promise<ChatResponse>
}

export type OneapiErrorData = {
  status?: number
  message?: string
  cause?: unknown
  details?: unknown
}

export class OneapiError extends Error {
  readonly status?: number
  readonly details?: unknown

  constructor(data: OneapiErrorData) {
    super(data.message ?? 'OneapiError')
    this.name = 'OneapiError'
    this.status = data.status
    this.details = data.details
    ;(this as { cause?: unknown }).cause = data.cause
  }
}

