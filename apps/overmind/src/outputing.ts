import type { Plugin } from '@opencode/plugable'
import type { OvermindHooks } from './kernel'
import type { KernelContext } from './types'
import type { TaskContext } from './task'

export const OutputPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:output',
  setup(api) {
    api.onOutput.tap((context: TaskContext) => {
      if (context.response) return context
      return { ...context, response: { requestId: context.request.requestId, success: false, error: 'No response', model: context.modelInfo } }
    })
  },
}

