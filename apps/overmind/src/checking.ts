import type { Plugin } from '@opencode/plugable'
import type { OvermindHooks } from './kernel'
import type { KernelContext } from './types'
import type { TaskContext } from './task'
import { parsePlan } from './check'

export const CheckPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:check',
  setup(api) {
    api.onCheck.tap((context: TaskContext) => {
      const result = parsePlan(context.modelText ?? '')
      if (!result.success || !result.plan) {
        const response = { requestId: context.request.requestId, success: false, error: result.error ?? 'Plan error', model: context.modelInfo }
        return { ...context, response }
      }

      const plan = result.plan
      const agent = api
        .context()
        .agentList.find(
          (item) => item.name === plan.agent || item.name.endsWith(`/${plan.agent}`) || item.name.endsWith(`:${plan.agent}`),
        )
      if (!agent) {
        const response = {
          requestId: context.request.requestId,
          success: false,
          error: `Agent not allowed: ${plan.agent}`,
          model: context.modelInfo,
        }
        return { ...context, response }
      }

      try {
        JSON.stringify(plan.input ?? null)
      } catch {
        const response = {
          requestId: context.request.requestId,
          success: false,
          error: 'Plan input is not JSON serializable',
          model: context.modelInfo,
        }
        return { ...context, response }
      }

      return { ...context, plan }
    })
  },
}
