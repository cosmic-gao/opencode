import type { IsolatePlugin, Request, Output, Process, Runner, Factory } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { nanoid } from 'nanoid'

interface PoolWorker {
  id: string
  handle: Process
  executor: Runner | null
  busy: boolean
  used: number
  lastActive: number
  health: 'ok' | 'suspected' | 'dead'
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

  async init(spawn: (permissions?: Deno.PermissionOptions) => Process | Promise<Process>) {
    const needed = Math.max(0, this.config.min - this.pool.length)
    const tasks = []
    for (let i = 0; i < needed; i++) {
      tasks.push(this.spawn(spawn))
    }
    await Promise.all(tasks)
    this.schedule()
  }

  private async spawn(create: (permissions?: Deno.PermissionOptions) => Process | Promise<Process>): Promise<PoolWorker | null> {
    if (this.pool.length >= this.config.max) {
      return null;
    }
    const handle = await create()
    const now = Date.now()
    const worker: PoolWorker = {
      id: nanoid(32),
      handle,
      executor: null,
      busy: false,
      used: now,
      lastActive: now,
      health: 'ok',
    }
    this.pool.push(worker)
    return worker
  }

  private schedule() {
    this.interval = setInterval(() => this.cleanup(), 30_000)
  }

  private check(worker: PoolWorker, now: number): void {
    if (worker.busy && now - worker.lastActive > 60_000) {
      worker.health = 'dead'
    } else if (!worker.busy && now - worker.lastActive > 300_000) {
      worker.health = 'suspected'
    }
  }

  private expire(worker: PoolWorker, now: number): boolean {
    return !worker.busy && worker.health !== 'dead' && now - worker.used > this.config.idle
  }

  private cleanup() {
    const now = Date.now()
    
    for (const w of this.pool) {
      this.check(w, now)
    }
    
    const dead = this.pool.filter(w => w.health === 'dead')
    for (const worker of dead) {
      console.warn(`[Cluster] Killing dead worker ${worker.id}`)
      this.kill(worker)
    }
    
    const expired = this.pool.filter(w => this.expire(w, now))

    for (const worker of expired) {
      if (this.pool.length <= this.config.min) break
      this.kill(worker)
    }
  }

  private remove(worker: PoolWorker): void {
    const index = this.pool.indexOf(worker)
    if (index >= 0) this.pool.splice(index, 1)
  }

  private kill(worker: PoolWorker) {
    try {
      worker.handle.kill()
    } catch {
      // ignore
    }
    this.remove(worker)
  }

  private find(): PoolWorker | null {
    return this.pool.find((w) => !w.busy && w.health === 'ok') ?? null
  }

  private async acquire(spawn: (permissions?: Deno.PermissionOptions) => Process | Promise<Process>): Promise<PoolWorker | null> {
    const idle = this.find()
    if (idle) return idle

    if (this.pool.length < this.config.max) {
      const worker = await this.spawn(spawn);
      return worker;
    }

    return null
  }

  async warmup(spawn: (permissions?: Deno.PermissionOptions) => Process | Promise<Process>, count: number): Promise<void> {
    const needed = Math.min(count, this.config.max - this.pool.length);
    const tasks = []
    for (let i = 0; i < needed; i++) {
      tasks.push(this.spawn(spawn))
    }
    await Promise.all(tasks)
  }

  private restore(worker: PoolWorker): void {
    worker.busy = false
    worker.used = Date.now()
    worker.lastActive = Date.now()
    worker.executor = null
    if (worker.health === 'suspected') {
      worker.health = 'ok'
    }
  }

  private release(worker: PoolWorker) {
    this.restore(worker)
  }

  async run(
    spawn: (permissions?: Deno.PermissionOptions) => Process | Promise<Process>,
    runner: (proc: Process, timeout: number) => Runner,
    request: Request,
    url: string,
    timeout: number,
    globals?: Record<string, unknown>,
    tools?: string[],
    permissions?: Deno.PermissionOptions
  ): Promise<Output> {
    const worker = await this.acquire(() => spawn(permissions))
    
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
    worker.lastActive = Date.now()  // 更新活跃时间
    worker.executor = runner(worker.handle, timeout)

    try {
      const out = await worker.executor.run(request, url, globals, tools)
      
      // 更新活跃时间
      worker.lastActive = Date.now()
      
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

  async setup(api) {
    const factory = (api.onWorker as APIHook<Factory> | undefined)?.use()
    
    if (!factory) {
      throw new Error('ClusterPlugin requires onWorker from SandboxPlugin')
    }

    const cluster = new Cluster({ min: 2, max: 8, idle: 120_000 })
    await cluster.warmup(factory.spawn, 2)
    await cluster.init(factory.spawn)

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
        ctx.tools,
        ctx.permissions
      )

      api.setContext({ output: out })
      return { ...ctx, output: out }
    })
  },
}
