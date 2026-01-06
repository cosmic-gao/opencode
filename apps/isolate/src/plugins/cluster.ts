import type { IsolatePlugin, Request, Output, WorkerHandle, WorkerExecutor, WorkerFactory } from '../types.ts'
import type { APIHook } from '@opencode/plugable'

interface PoolWorker {
  handle: WorkerHandle
  executor: WorkerExecutor | null
  busy: boolean
  used: number
}

interface ClusterOptions {
  min: number
  max: number
  idle: number
}

class Cluster {
  private pool: PoolWorker[] = []
  private config: ClusterOptions
  private interval?: number

  constructor(config: Partial<ClusterOptions> = {}) {
    this.config = {
      min: 2,
      max: 8,
      idle: 120_000,
      ...config,
    }
  }

  initialize(createWorker: () => WorkerHandle) {
    for (let i = 0; i < this.config.min; i++) {
      this.spawn(createWorker)
    }
    this.schedule()
  }

  private spawn(createWorker: () => WorkerHandle): PoolWorker {
    const handle = createWorker()
    const worker: PoolWorker = {
      handle,
      executor: null,
      busy: false,
      used: Date.now(),
    }
    this.pool.push(worker)
    return worker
  }

  private schedule() {
    this.interval = setInterval(() => this.cleanup(), 30_000)
  }

  private cleanup() {
    const now = Date.now()
    const expired = this.pool.filter(
      (w) => !w.busy && now - w.used > this.config.idle
    )

    for (const worker of expired) {
      if (this.pool.length <= this.config.min) break
      this.terminate(worker)
    }
  }

  private terminate(worker: PoolWorker) {
    try {
      worker.handle.kill()
    } catch {
      // ignore
    }
    const index = this.pool.indexOf(worker)
    if (index >= 0) this.pool.splice(index, 1)
  }

  private acquire(createWorker: () => WorkerHandle): PoolWorker | null {
    const idle = this.pool.find((w) => !w.busy)
    if (idle) return idle

    if (this.pool.length < this.config.max) {
      return this.spawn(createWorker)
    }

    return null
  }

  private release(worker: PoolWorker) {
    worker.busy = false
    worker.used = Date.now()
    worker.executor = null
  }

  async execute(
    createWorker: () => WorkerHandle,
    createExecutor: (handle: WorkerHandle, timeout: number) => WorkerExecutor,
    request: Request,
    url: string,
    timeout: number
  ): Promise<Output> {
    const worker = this.acquire(createWorker)
    
    if (!worker) {
      return {
        ok: false,
        logs: [{
          level: 'exception',
          message: 'Worker pool exhausted',
          name: 'ClusterError',
          timestamp: Date.now(),
        }],
        duration: 0,
      }
    }

    worker.busy = true
    worker.executor = createExecutor(worker.handle, timeout)

    try {
      const out = await worker.executor.execute(request, url)
      
      const timeout = out.logs?.some(
        log => log.level === 'exception' && log.name === 'TimeoutError'
      )
      
      if (timeout) {
        this.terminate(worker)
      } else {
        this.release(worker)
      }
      
      return out
    } catch (err) {
      this.terminate(worker)
      const log = {
        level: 'exception' as const,
        message: err instanceof Error ? err.message : 'Unknown error',
        name: 'ExecutionError',
        timestamp: Date.now(),
      }
      return {
        ok: false,
        logs: [log],
        duration: 0,
      }
    }
  }

  destroy() {
    if (this.interval !== undefined) {
      clearInterval(this.interval)
    }
    for (const worker of this.pool) {
      try {
        worker.handle.kill()
      } catch {
        // ignore
      }
    }
    this.pool = []
  }
}

export const ClusterPlugin: IsolatePlugin = {
  name: 'opencode:cluster',
  pre: ['opencode:loader'],
  post: [],
  required: ['opencode:guard', 'opencode:loader', 'opencode:sandbox'],
  usePlugins: [],
  registryHook: {},

  setup(api) {
    const factory = (api.onWorker as APIHook<WorkerFactory> | undefined)?.use()
    
    if (!factory) {
      throw new Error('ClusterPlugin requires onWorker from SandboxPlugin')
    }

    const cluster = new Cluster({ min: 2, max: 8, idle: 120_000 })
    cluster.initialize(factory.createWorker)

    api.onExecute.tap(async (ctx) => {
      const { request, url, config } = ctx
      const limit = request.timeout ?? config.timeout

      const out = await cluster.execute(
        factory.createWorker,
        factory.createExecutor,
        request,
        url,
        limit
      )

      api.setContext({ output: out })
      return { ...ctx, output: out }
    })
  },
}

