export type KeyRequest = {
  provider?: string
  model?: string
  keyName?: string
}

export interface KeyStore {
  get: (request: KeyRequest) => string | undefined
}

export type EnvKeyStoreOptions = {
  env?: Record<string, string | undefined>
  prefix?: string
}

function toKey(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase()
}

function readKey(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export class EnvKeyStore implements KeyStore {
  private env: Record<string, string | undefined>
  private prefix: string

  constructor(options: EnvKeyStoreOptions = {}) {
    this.env = options.env ?? (process.env as Record<string, string | undefined>)
    this.prefix = options.prefix ?? 'ONEAPI_API_KEY'
  }

  get(request: KeyRequest): string | undefined {
    const keyName = request.keyName ? readKey(this.env, `${this.prefix}_${toKey(request.keyName)}`) : undefined
    if (keyName) return keyName

    const model = request.model ? readKey(this.env, `${this.prefix}_${toKey(request.model)}`) : undefined
    if (model) return model

    const provider = request.provider ? readKey(this.env, `${this.prefix}_${toKey(request.provider)}`) : undefined
    if (provider) return provider

    return readKey(this.env, this.prefix)
  }
}

export function createEnvKeyStore(options: EnvKeyStoreOptions = {}): EnvKeyStore {
  return new EnvKeyStore(options)
}

