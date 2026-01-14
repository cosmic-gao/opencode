import type { Plugin } from '@opencode/plugable'
import type { OvermindHooks } from './kernel'
import type { KernelContext } from './types'
import type { TaskContext } from './task'

export const InputPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:input',
  setup(api) {
    api.onInput.tap((context: TaskContext) => context)
  },
}

