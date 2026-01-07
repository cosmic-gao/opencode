import type { IsolatePlugin, Request } from '../types.ts'

function check(code: string, max: number): void {
  if (code.length > max) {
    const e = new Error('Code size exceeds limit');
    e.name = 'PayloadTooLarge';
    throw e;
  }
}

export function validate(x: unknown, max: number, timeout: number): Request {
  if (typeof x !== 'object' || x === null) {
    throw new Error('Invalid request: expected object')
  }

  const o = x as Record<string, unknown>
  const code = o.code
  
  if (typeof code !== 'string') {
    throw new Error('Invalid request: code must be string');
  }

  check(code, max);

  const input = o.input as unknown
  const entry = typeof o.entry === 'string' ? o.entry : 'default'
  const limit = typeof o.timeout === 'number' ? o.timeout : timeout
  
  const tools = Array.isArray(o.tools)
    ? (o.tools as unknown[]).filter(t => typeof t === 'string') as string[]
    : undefined
  
  const permissions = o.permissions as Deno.PermissionOptions | undefined

  return { code, input, entry, timeout: limit, tools, permissions }
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
