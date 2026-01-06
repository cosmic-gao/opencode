import type { IsolatePlugin, Request } from '../types.ts'

export function validate(x: unknown, max: number, timeout: number): Request {
  if (typeof x !== 'object' || x === null) {
    throw new Error('Invalid request: expected object')
  }

  const o = x as Record<string, unknown>
  const code = o.code

  if (typeof code !== 'string') {
    throw new Error('Invalid request: code must be a string')
  }

  if (code.length > max) {
    const e = new Error('Code size exceeds limit')
    e.name = 'PayloadTooLarge'
    throw e
  }

  const input = o.input as unknown
  const entry = typeof o.entry === 'string' ? o.entry : 'default'
  const limit = typeof o.timeout === 'number' ? o.timeout : timeout

  return { code, input, entry, timeout: limit }
}

export const GuardPlugin: IsolatePlugin = {
  name: 'opencode:guard',
  pre: [],
  post: [],
  required: [],
  usePlugins: [],
  registryHook: {},

  setup(api) {
    api.onValidate.tap((request) => {
      const { config } = api.context()
      return validate(request, config.maxSize, config.timeout)
    })
  },
}
