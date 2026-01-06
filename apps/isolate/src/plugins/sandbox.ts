import type { IsolatePlugin, Process, Runner, Factory, Request, Output, Packet } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { createAPIHook } from '@opencode/plugable'
import { send, wait } from '../bridge.ts'

function spawn(permissions?: Deno.PermissionOptions): Process {
  const url = new URL('../worker.ts', import.meta.url).href
  const perms = permissions || "none"
  const options = { 
    type: 'module', 
    deno: { permissions: perms }
  } as WorkerOptions
  const worker = new Worker(url, options)

  const kill = () => {
    try {
      worker.terminate()
    } catch {
      // ignore
    }
  }

  return { worker, kill }
}

function runner(proc: Process, timeout: number): Runner {
  const run = async (request: Request, url: string, globals?: Record<string, unknown>, tools?: string[]): Promise<Output> => {
    const start = performance.now()
    const abort = new AbortController();
    let tid: number | undefined

    try {
      const res = wait(proc.worker, abort.signal)

      const limit = new Promise<Output>((resolve) => {
        tid = setTimeout(() => {
          abort.abort();
          try {
            proc.kill();
          } catch {
            // ignore
          }
          resolve({
            ok: false,
            logs: [{
              level: 'exception',
              message: 'Execution timeout',
              name: 'TimeoutError',
              timestamp: Date.now(),
            }],
            duration: Math.round(performance.now() - start),
          })
        }, timeout)
      })

      const msg: Packet = {
        code: request.code,
        input: request.input as unknown,
        entry: request.entry ?? 'default',
        url,
        tools, 
        globals,
      }

      send(proc.worker, msg)

      const out = await Promise.race([res, limit])
      const duration = Math.round(performance.now() - start)
      
      return {
        ...out,
        duration: duration,
      }
    } finally {
      if (tid !== undefined) {
        clearTimeout(tid)
      }
    }
  }

  return { run }
}

const factory: Factory = {
  spawn: (permissions?: Deno.PermissionOptions) => {
    const proc = spawn(permissions)
    return proc
  },
  runner,
}

export const SandboxPlugin: IsolatePlugin = {
  name: 'opencode:sandbox',
  pre: ['opencode:loader'],
  post: [],
  required: ['opencode:guard', 'opencode:loader'],
  usePlugins: [],
  registryHook: {
    onWorker: createAPIHook<Factory>(),
  },

  setup(api) {
    if (!api.onWorker) {
      throw new Error('onWorker not registered');
    }

    const hookedFactory: Factory = {
      spawn: (permissions?: Deno.PermissionOptions) => {
        const proc = factory.spawn(permissions);
        api.onSpawn.call(proc);
        return proc;
      },
      runner: factory.runner,
    };

    (api.onWorker as APIHook<Factory>).provide(hookedFactory);

    api.onExecute.tap(async (ctx) => {
      const { request, url, config } = ctx;
      const limit = request.timeout ?? config.timeout;
      
      const w = hookedFactory.spawn(ctx.permissions);
      const task = hookedFactory.runner(w, limit);
      
      const out = await task.run(request, url, ctx.globals, ctx.tools);
      
      api.setContext({ output: out });
      return { ...ctx, output: out };
    });
  },
};
