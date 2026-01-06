import type { Tool, Registry } from './types.ts'
import { crypto } from './crypto.ts'

export type { Tool, Registry } from './types.ts'

export const tools: Tool[] = [
  crypto,
]

export function registry(items: Tool[]): Registry {
  const result: Registry = {}
  for (const tool of items) {
    result[tool.name] = tool
  }
  return result
}

export const defaults = registry(tools)

export function setup(items: Tool[], globals: Record<string, unknown>): void {
  for (const tool of items) {
    tool.setup(globals)
  }
}
