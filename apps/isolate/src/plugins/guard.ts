import type { IsolatePlugin, Request } from '../types.ts'

function ensure(value: unknown, type: string, name: string): void {
  if (typeof value !== type) {
    throw new Error(`Invalid request: ${name} must be ${type}`);
  }
}

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

  ensure(code, 'string', 'code');
  check(code as string, max);

  const input = o.input as unknown
  const entry = typeof o.entry === 'string' ? o.entry : 'default'
  const limit = typeof o.timeout === 'number' ? o.timeout : timeout

  return { code: code as string, input, entry, timeout: limit }
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
