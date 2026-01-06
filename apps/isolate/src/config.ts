import type { Config } from './types.ts'

export const DEFAULT_CONFIG: Config = {
  maxSize: 100_000,
  timeout: 3_000,
  port: 8787,
}

export function merge(partial?: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...partial }
}
