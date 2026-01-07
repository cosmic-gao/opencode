import { createManager, createAsyncHook, createSyncHook } from '@opencode/plugable'
import type { IsolateHooks, IsolatePlugin, Context, Config, Output, Request, Process } from './types.ts'
import { GuardPlugin, LoaderPlugin, PermissionPlugin, SandboxPlugin, ClusterPlugin, LoggerPlugin, ToolsetPlugin, ChannelPlugin, DatabasePlugin } from './plugins/index.ts'

const DEFAULT: Config = {
  maxSize: 100_000,
  timeout: 3_000,
  port: 8787,
}

function wire(): IsolateHooks {
  return {
    onValidate: createAsyncHook<Request>(),
    onLoad: createAsyncHook<Context>(),
    onSpawn: createSyncHook<Process>(),
    onExecute: createAsyncHook<Context>(),
    onFormat: createAsyncHook<Output>(),
  }
}

function context(config: Config, request: Request): Context {
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

export async function create(options: IsolateConfig = {}): Promise<Isolate> {
  const config: Config = { ...DEFAULT, ...options.config }
  const cluster = options.useCluster ?? true

  const manager = createManager<IsolateHooks, Context>({
    hooks: wire(),
    context: context(config, { code: '', input: undefined, entry: 'default', timeout: config.timeout }),
  })

  manager.use([
    GuardPlugin,
    DatabasePlugin,
    ToolsetPlugin,
    LoaderPlugin,
    PermissionPlugin,
    SandboxPlugin,
    ChannelPlugin,
    ...(cluster ? [ClusterPlugin] : []),
    LoggerPlugin,
  ])

  if (options.plugins?.length) {
    manager.use(options.plugins)
  }

  await manager.init()

  const pipe = manager.getHooks()

  async function execute(input: unknown): Promise<Output> {
    try {
      const request = await pipe.onValidate.call(input as Request)
      manager.setContext(context(config, request))
      let ctx = manager.getContext()
      ctx = await pipe.onLoad.call(ctx)
      ctx = await pipe.onExecute.call(ctx)
      
      if (config.audit) {
        console.log('[Audit]', {
          tools: ctx.tools,
          permissions: ctx.permissions,
          duration: ctx.output?.duration,
        })
      }
      
      if (ctx.output) {
        return await pipe.onFormat.call(ctx.output)
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

