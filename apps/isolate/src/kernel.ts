import { createManager, createAsyncHook, createSyncHook } from '@opencode/plugable'
import type { IsolateHooks, IsolatePlugin, Context, Config, Output, Request, Process } from './types.ts'
import { GuardPlugin, LoaderPlugin, SandboxPlugin, ClusterPlugin, LoggerPlugin, ToolsetPlugin, ChannelPlugin } from './plugins/index.ts'

const DEFAULT_CONFIG: Config = {
  maxSize: 100_000,
  timeout: 3_000,
  port: 8787,
}

function createHooks(): IsolateHooks {
  return {
    onValidate: createAsyncHook<Request>(),
    onLoad: createAsyncHook<Context>(),
    onSpawn: createSyncHook<Process>(),
    onExecute: createAsyncHook<Context>(),
    onFormat: createAsyncHook<Output>(),
  }
}

function createContext(config: Config, request: Request): Context {
  return {
    config,
    request,
    url: '',
    output: null,
  }
}

export interface IsolateConfig {
  config?: Partial<Config>
  plugins?: IsolatePlugin[]
  useCluster?: boolean
}

export interface Isolate {
  execute: (input: unknown) => Promise<Output>
  getConfig: () => Config
  hasPlugin: (name: string) => boolean
}

export async function createIsolate(options: IsolateConfig = {}): Promise<Isolate> {
  const config: Config = { ...DEFAULT_CONFIG, ...options.config }
  const cluster = options.useCluster ?? true

  const manager = createManager<IsolateHooks, Context>({
    hooks: createHooks(),
    context: createContext(config, { code: '', input: undefined, entry: 'default', timeout: config.timeout }),
  })

  manager.use([
    GuardPlugin,
    ToolsetPlugin,
    LoaderPlugin,
    SandboxPlugin,
    ChannelPlugin,
    ...(cluster ? [ClusterPlugin] : []),
    LoggerPlugin,
  ])

  if (options.plugins?.length) {
    manager.use(options.plugins)
  }

  await manager.init()

  const hooks = manager.getHooks()

  async function execute(input: unknown): Promise<Output> {
    try {
      const request = await hooks.onValidate.call(input as Request)
      manager.setContext(createContext(config, request))
      let ctx = manager.getContext()
      ctx = await hooks.onLoad.call(ctx)
      ctx = await hooks.onExecute.call(ctx)
      if (ctx.output) {
        return await hooks.onFormat.call(ctx.output)
      }
      return {
        ok: false,
        logs: [{
          level: 'exception',
          message: 'No output produced',
          name: 'ExecutionError',
          timestamp: Date.now(),
        }],
        duration: 0,
      }
    } catch (e) {
      const err = e as Error
      return {
        ok: false,
        logs: [{
          level: 'exception',
          message: err.message,
          name: err.name,
          stack: err.stack,
          timestamp: Date.now(),
        }],
        duration: 0,
      }
    }
  }

  return {
    execute,
    getConfig: () => config,
    hasPlugin: (name: string) => manager.exists(name),
  }
}

