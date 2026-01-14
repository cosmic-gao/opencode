import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { Plugin } from '@opencode/plugable'

import type { AgentSpec, KernelContext } from './types'
import type { OvermindHooks } from './kernel'
import { loadSpec } from './load'

export const ScanPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:scan',
  setup(api) {
    api.onScan.tap(async (context) => {
      const agentsPath = path.join(context.rootPath, 'agents')
      const list = await fs.readdir(agentsPath, { withFileTypes: true }).catch(() => [])

      const agentList: AgentSpec[] = []
      for (const item of list) {
        if (!item.isDirectory()) continue
        const dirPath = path.join(agentsPath, item.name)
        const spec = await loadSpec(dirPath)
        if (spec) agentList.push(spec)
      }

      const next: KernelContext = { ...context, agentList }
      api.setContext(next)
      return next
    })
  },
}
