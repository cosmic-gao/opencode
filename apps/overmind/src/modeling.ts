import type { Plugin } from '@opencode/plugable'
import type { OvermindHooks } from './kernel'
import type { KernelContext } from './types'
import type { TaskContext } from './task'
import { callModel } from './model'

export const ModelPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:model',
  setup(api) {
    api.onModel.tap(async (context: TaskContext) => {
      const messages = Array.isArray(context.messages) ? context.messages : []
      const model = await callModel(context.request, messages as never)
      return { ...context, modelText: model.text, modelInfo: { provider: model.provider, model: model.model, usage: model.usage } }
    })
  },
}

