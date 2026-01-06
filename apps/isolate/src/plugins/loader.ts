import type { IsolatePlugin } from '../types.ts'

export function encode(code: string): string {
  const base = btoa(code)
  return `data:application/javascript;base64,${base}`
}

export const LoaderPlugin: IsolatePlugin = {
  name: 'opencode:loader',
  pre: ['opencode:guard'],
  post: [],
  required: [],
  usePlugins: [],
  registryHook: {},

  setup(api) {
    api.onLoad.tap((ctx) => {
      const url = encode(ctx.request.code)
      api.setContext({ url })
      return { ...ctx, url }
    })
  },
}
