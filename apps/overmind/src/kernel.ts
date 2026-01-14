import { createAsyncHook, createManager } from '@opencode/plugable'
import type { AnyHook, Hooks, Plugin } from '@opencode/plugable'

import type { AgentSpec, KernelContext, RunContext, RunResponse } from './types'
import { RunPlugin } from './run'
import { ScanPlugin } from './scan'

export type OvermindHooks = Hooks & {
  onScan: ReturnType<typeof createAsyncHook<KernelContext>>
  onRun: ReturnType<typeof createAsyncHook<RunContext>>
  [key: string]: AnyHook
}

export type KernelOptions = {
  rootPath: string
  plugins?: Plugin<OvermindHooks, KernelContext>[]
}

function hooks(): OvermindHooks {
  return {
    onScan: createAsyncHook<KernelContext>(),
    onRun: createAsyncHook<RunContext>(),
  } as OvermindHooks
}

export type Kernel = {
  scan: () => Promise<AgentSpec[]>
  list: () => Promise<AgentSpec[]>
  run: (name: string, inputText: string) => Promise<RunResponse>
}

export async function createKernel(options: KernelOptions): Promise<Kernel> {
  const manager = createManager<OvermindHooks, KernelContext>({
    hooks: hooks(),
    context: { rootPath: options.rootPath, agentList: [] },
  })

  manager.use([ScanPlugin, RunPlugin])
  if (options.plugins?.length) manager.use(options.plugins)

  await manager.init()
  const pipe = manager.getHooks()

  async function scan(): Promise<AgentSpec[]> {
    const context = await pipe.onScan.call(manager.getContext())
    manager.setContext(context)
    return context.agentList
  }

  async function list(): Promise<AgentSpec[]> {
    return await scan()
  }

  async function run(name: string, inputText: string): Promise<RunResponse> {
    const agentList = await scan()
    const agent = agentList.find((item) => item.name === name || item.name.endsWith(`/${name}`) || item.name.endsWith(`:${name}`)) ?? null
    if (!agent) {
      return { success: false, text: '', error: `Agent not found: ${name}` }
    }

    const context: RunContext = { agent, inputText }
    const next = await pipe.onRun.call(context)
    return next.response ?? { success: false, text: '', error: 'No response' }
  }

  return { scan, list, run }
}
