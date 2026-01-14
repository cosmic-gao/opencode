import { OneapiError, type ChatRequest, type ChatResponse, type Provider, type Usage } from './types'
import type { KeyStore } from './key'

export type OpenaiOptions = {
  baseUrl: string
  apiKey?: string
  keyStore?: KeyStore
  provider?: string
  timeoutMs?: number
}

type OpenaiMessage = {
  role: string
  content: string
}

type OpenaiUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

type OpenaiChoice = {
  message?: {
    content?: string | null
  }
}

type OpenaiChatResponse = {
  choices?: OpenaiChoice[]
  usage?: OpenaiUsage
}

function trimSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function joinUrl(baseUrl: string, path: string): string {
  const base = trimSlash(baseUrl)
  const next = path.startsWith('/') ? path : `/${path}`
  return base + next
}

function mapUsage(usage?: OpenaiUsage): Usage | undefined {
  if (!usage) return undefined
  const inputTokens = usage.prompt_tokens ?? 0
  const outputTokens = usage.completion_tokens ?? 0
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens
  return { inputTokens, outputTokens, totalTokens }
}

function mapMessages(request: ChatRequest): OpenaiMessage[] {
  return request.messages.map((message) => ({ role: message.role, content: message.text }))
}

export class OpenaiProvider implements Provider {
  private baseUrl: string
  private apiKey?: string
  private keyStore?: KeyStore
  private provider?: string
  private timeoutMs: number

  constructor(options: OpenaiOptions) {
    this.baseUrl = options.baseUrl
    this.apiKey = options.apiKey
    this.keyStore = options.keyStore
    this.provider = options.provider
    this.timeoutMs = options.timeoutMs ?? 60_000
  }

  private getKey(request: ChatRequest): string {
    if (this.apiKey) return this.apiKey
    if (typeof request.keyName === 'string' && /^sk-[A-Za-z0-9]{10,}/.test(request.keyName)) {
      throw new OneapiError({
        message: 'Invalid keyName: keyName is a selector, set ONEAPI_API_KEY / ONEAPI_API_KEY_* in env',
      })
    }
    const apiKey = this.keyStore?.get({
      provider: request.provider ?? this.provider,
      model: request.model,
      keyName: request.keyName,
    })
    if (apiKey) return apiKey
    throw new OneapiError({ message: 'Missing apiKey' })
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const url = joinUrl(this.baseUrl, '/v1/chat/completions')
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), this.timeoutMs)

    try {
      const apiKey = this.getKey(request)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: mapMessages(request),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
        signal: abort.signal,
      })

      const json = (await response.json().catch(() => null)) as OpenaiChatResponse | null
      if (!response.ok) {
        throw new OneapiError({
          status: response.status,
          message: 'OpenaiProvider request failed',
          details: json,
        })
      }

      const text = json?.choices?.[0]?.message?.content ?? ''
      return {
        text,
        usage: mapUsage(json?.usage),
        raw: json ?? undefined,
      }
    } catch (cause) {
      if (cause instanceof OneapiError) throw cause
      throw new OneapiError({ message: 'OpenaiProvider request error', cause })
    } finally {
      clearTimeout(timer)
    }
  }
}

export function createOpenaiProvider(options: OpenaiOptions): OpenaiProvider {
  return new OpenaiProvider(options)
}
