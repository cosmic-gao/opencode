import type { IsolatePlugin, ToolsetFactory, Context } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { createAPIHook } from '@opencode/plugable'
import { tools, defaults, setup } from '../tools/index.ts'

const factory: ToolsetFactory = {
  tools: () => tools,
  registry: () => defaults,
  setup,
}

export const ToolsetPlugin: IsolatePlugin = {
  name: 'opencode:tools',
  pre: ['opencode:guard'],
  post: ['opencode:loader'],
  required: ['opencode:guard'],
  usePlugins: [],
  registryHook: {
    onToolset: createAPIHook<ToolsetFactory>(),
  },

  setup(api) {
    if (!api.onToolset) {
      throw new Error('onToolset not registered')
    }

    (api.onToolset as APIHook<ToolsetFactory>).provide(factory)

    api.onLoad.tap((ctx: Context) => {
      const items = factory.tools()
      const globals: Record<string, unknown> = {}
      
      // 在全局上下文中注入工具,而非字符串拼接
      factory.setup(items, globals)
      
      // 将工具全局对象添加到上下文中
      const updated: Context = { 
        ...ctx,
        globals,
      }
      
      api.setContext(updated)
      
      return updated
    })
  },
}
