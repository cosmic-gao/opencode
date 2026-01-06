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

  init(spawn: () => Process) {
    for (let i = 0; i < this.config.min; i++) {
      this.spawn(spawn)
    }
    this.schedule()
  }

  private spawn(create: () => Process): PoolWorker {
    const handle = create()
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

  private cleanup() {
    const now = Date.now()
    
    // 健康检查：标记长时间无响应的Worker为dead
    for (const w of this.pool) {
      if (w.busy && now - w.lastActive > 60_000) {
        // Worker忙碌超过60秒无响应
        w.health = 'dead'
      } else if (!w.busy && now - w.lastActive > 300_000) {
        // Worker空闲超过5分钟无活动
        w.health = 'suspected'
      }
    }
    
    // 清理dead状态的Worker
    const dead = this.pool.filter(w => w.health === 'dead')
    for (const worker of dead) {
      console.warn(`[Cluster] Killing dead worker ${worker.id}`)
      this.kill(worker)
    }
    
    // 清理空闲过期的Worker（保持最小数量）
    const expired = this.pool.filter(
      (w) => !w.busy && w.health !== 'dead' && now - w.used > this.config.idle
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
    // 优先选择健康的空闲Worker
    const idle = this.pool.find((w) => !w.busy && w.health === 'ok')
    if (idle) return idle

    // 如果没有健康的Worker且池未满，创建新Worker
    if (this.pool.length < this.config.max) {
      return this.spawn(spawn)
    }

    return null
  }

  private release(worker: PoolWorker) {
    worker.busy = false
    worker.used = Date.now()
    worker.lastActive = Date.now()
    worker.executor = null
    // 恢复健康状态
    if (worker.health === 'suspected') {
      worker.health = 'ok'
    }
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
