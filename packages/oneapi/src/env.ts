import { Client } from './client'
import { createEnvKeyStore } from './key'
import { createOpenaiProvider } from './openai'

export type EnvClient = {
  client: Client
  model: string
  provider: string
}

export type EnvOptions = {
  env?: Record<string, string | undefined>
}

function readValue(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function defaultBaseUrl(provider: string): string {
  if (provider === 'deepseek') return 'https://api.deepseek.com'
  return 'https://api.openai.com'
}

function defaultModel(provider: string): string {
  if (provider === 'deepseek') return 'deepseek-chat'
  return 'gpt-4o-mini'
}

export function createClientFromEnv(options: EnvOptions = {}): EnvClient {
  const env = options.env ?? (process.env as Record<string, string | undefined>)

  const provider = readValue(env, 'ONEAPI_PROVIDER') ?? 'openai'
  const baseUrl = readValue(env, 'ONEAPI_BASE_URL') ?? defaultBaseUrl(provider)
  const model = readValue(env, 'ONEAPI_MODEL') ?? defaultModel(provider)

  const keyStore = createEnvKeyStore({ env })
  const openai = createOpenaiProvider({ baseUrl, keyStore, provider })

  const client = new Client({ provider: openai })
  return { client, model, provider }
}
