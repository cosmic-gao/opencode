import type { IsolatePlugin, Process, Runner, Factory, Request, Output, Packet } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { createAPIHook } from '@opencode/plugable'
import { send, wait } from '../bridge.ts'

function spawn(): Process {
  const url = new URL('../worker.ts', import.meta.url).href
  const options = { type: 'module', deno: { permissions: 'none' } } as WorkerOptions
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
    const res = wait(proc.worker)

    let tid: number | undefined
    const limit = new Promise<Output>((resolve) => {
      tid = setTimeout(() => {
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
    
    if (tid !== undefined) {
      clearTimeout(tid)
    }
    
    const duration = Math.round(performance.now() - start)
    
    return {
      ...out,
      duration: duration,
    }
  }

  return { run }
}

const wrappedFactory: Factory = {
  spawn: () => {
    const proc = spawn();
    return proc;
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
      throw new Error('onWorker not registered')
    }

    const hookedFactory: Factory = {
      spawn: () => {
        const proc = wrappedFactory.spawn();
        api.onSpawn.call(proc);
        return proc;
      },
      runner: wrappedFactory.runner,
    };

    (api.onWorker as APIHook<Factory>).provide(hookedFactory)

    api.onExecute.tap(async (ctx) => {
      const { request, url, config } = ctx
      const limit = request.timeout ?? config.timeout
      
      const w = hookedFactory.spawn()
      const task = hookedFactory.runner(w, limit)
      
      const out = await task.run(request, url, ctx.globals, ctx.tools)
      
      api.setContext({ output: out })
      return { ...ctx, output: out }
    })
  },
}
