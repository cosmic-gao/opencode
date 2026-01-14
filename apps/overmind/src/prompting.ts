import type { Plugin } from '@opencode/plugable'
import type { OvermindHooks } from './kernel'
import type { KernelContext } from './types'
import type { TaskContext } from './task'
import { buildPrompt } from './prompt'

export const PromptPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:prompt',
  setup(api) {
    api.onPrompt.tap((context: TaskContext) => {
      const prompt = buildPrompt(context.request, api.context().agentList)
      return { ...context, promptText: prompt.promptText, messages: prompt.messages }
    })
  },
}
