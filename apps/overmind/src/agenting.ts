import type { Plugin } from '@opencode/plugable'
import type { OvermindHooks } from './kernel'
import type { KernelContext } from './types'
import type { TaskContext, TaskResponse } from './task'

export type AgentOptions = {
  run: (name: string, inputText: string) => Promise<{ success: boolean; text: string; data?: unknown; error?: string }>
}

export function createAgentPlugin(options: AgentOptions): Plugin<OvermindHooks, KernelContext> {
  return {
    name: 'overmind:agent',
    setup(api) {
      api.onAgent.tap(async (context: TaskContext) => {
        if (!context.plan) return context
        const inputText = JSON.stringify(context.plan.input ?? null)
        const agent = await options.run(context.plan.agent, inputText)
        const response: TaskResponse = {
          requestId: context.request.requestId,
          success: agent.success,
          plan: context.plan,
          model: context.modelInfo,
          agent: {
            name: context.plan.agent,
            success: agent.success,
            data: agent.data,
            text: agent.text,
            error: agent.error,
          },
        }
        return { ...context, response }
      })
    },
  }
}

