import type { IsolatePlugin, WorkerHandle, WorkerExecutor, WorkerFactory, Request, Output, Packet } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { createAPIHook } from '@opencode/plugable'
import { send, wait } from '../bridge.ts'

function create(): WorkerHandle {
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

function execute(handle: WorkerHandle, timeout: number): WorkerExecutor {
  const run = async (request: Request, url: string): Promise<Output> => {
    const start = performance.now()
    const res = wait(handle.worker)

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
    }

    send(handle.worker, msg)

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

  return { execute: run }
}

const factory: WorkerFactory = {
  createWorker: create,
  createExecutor: execute,
}

export const SandboxPlugin: IsolatePlugin = {
  name: 'opencode:sandbox',
  pre: ['opencode:loader'],
  post: [],
  required: ['opencode:guard', 'opencode:loader'],
  usePlugins: [],
  registryHook: {
    onWorker: createAPIHook<WorkerFactory>(),
  },

  setup(api) {
    if (!api.onWorker) {
      throw new Error('onWorker not registered')
    }

    (api.onWorker as APIHook<WorkerFactory>).provide(factory)

    api.onExecute.tap(async (ctx) => {
      const { request, url, config } = ctx
      const limit = request.timeout ?? config.timeout
      
      const w = factory.createWorker()
      const exec = factory.createExecutor(w, limit)
      
      const out = await exec.execute(request, url)
      
      api.setContext({ output: out })
      return { ...ctx, output: out }
    })
  },
}

