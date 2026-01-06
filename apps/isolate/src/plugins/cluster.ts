import type { IsolatePlugin, Request, Output, Process, Runner, Factory } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { nanoid } from 'nanoid'

interface PoolWorker {
  id: string
  handle: Process
  executor: Runner | null
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

  init(spawn: () => Process) {
    for (let i = 0; i < this.config.min; i++) {
      this.spawn(spawn)
    }
    this.schedule()
  }

  private spawn(create: () => Process): PoolWorker {
    const handle = create()
    const worker: PoolWorker = {
      id: nanoid(32),
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
      this.kill(worker)
    }
  }

  private kill(worker: PoolWorker) {
    try {
      worker.handle.kill()
    } catch {
      // ignore
    }
    const index = this.pool.indexOf(worker)
    if (index >= 0) this.pool.splice(index, 1)
  }

  private acquire(spawn: () => Process): PoolWorker | null {
    const idle = this.pool.find((w) => !w.busy)
    if (idle) return idle

    if (this.pool.length < this.config.max) {
      return this.spawn(spawn)
    }

    return null
  }

  private release(worker: PoolWorker) {
    worker.busy = false
    worker.used = Date.now()
    worker.executor = null
  }

  async run(
    spawn: () => Process,
    runner: (proc: Process, timeout: number) => Runner,
    request: Request,
    url: string,
    timeout: number,
    globals?: Record<string, unknown>,
    tools?: string[]
  ): Promise<Output> {
    const worker = this.acquire(spawn)
    
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
    worker.executor = runner(worker.handle, timeout)

    try {
      const out = await worker.executor.run(request, url, globals, tools)
      
      const timeoutErr = out.logs?.some(
        log => log.level === 'exception' && log.name === 'TimeoutError'
      )
      
      if (timeoutErr) {
        this.kill(worker)
      } else {
        this.release(worker)
      }
      
      return out
    } catch (err) {
      this.kill(worker)
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
    const factory = (api.onWorker as APIHook<Factory> | undefined)?.use()
    
    if (!factory) {
      throw new Error('ClusterPlugin requires onWorker from SandboxPlugin')
    }

    const cluster = new Cluster({ min: 2, max: 8, idle: 120_000 })
    cluster.init(factory.spawn)

    api.onExecute.tap(async (ctx) => {
      const { request, url, config } = ctx
      const limit = request.timeout ?? config.timeout

      const out = await cluster.run(
        factory.spawn,
        factory.runner,
        request,
        url,
        limit,
        ctx.globals,
        ctx.tools
      )

      api.setContext({ output: out })
      return { ...ctx, output: out }
    })
  },
}
