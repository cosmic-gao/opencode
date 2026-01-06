import type { Plugin, AsyncHook, Hooks, AnyHook } from '@opencode/plugable'

export type Fault = { name: string; message: string; stack?: string }

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'exception'

export type LogEntry = {
  level: LogLevel
  message: string
  timestamp: number
  name?: string
  stack?: string
}

export type Output = {
  ok: boolean
  result?: unknown
  logs?: readonly LogEntry[]
  duration: number
}

export interface Request {
  readonly code: string
  readonly input?: unknown
  readonly entry?: string
  readonly timeout?: number
}

export type Reply = Output

export interface Packet {
  readonly code: string
  readonly input: unknown
  readonly entry: string
  readonly url: string
}

export interface Config {
  readonly maxSize: number
  readonly timeout: number
  readonly port: number
}

export interface Context {
  config: Config
  request: Request
  url: string
  output: Output | null
}

export interface IsolateHooks extends Hooks {
  onValidate: AsyncHook<Request>
  onLoad: AsyncHook<Context>
  onExecute: AsyncHook<Context>
  onFormat: AsyncHook<Output>
  [key: string]: AnyHook
}

export type IsolatePlugin = Plugin<IsolateHooks, Context>

export interface WorkerHandle {
  readonly worker: Worker
  kill: () => void
}

export interface WorkerExecutor {
  execute: (request: Request, url: string) => Promise<Output>
}

export interface WorkerFactory {
  createWorker: () => WorkerHandle
  createExecutor: (handle: WorkerHandle, timeout: number) => WorkerExecutor
}

export interface LoggerFactory {
  filter: (logs: readonly LogEntry[], options?: { minLevel?: LogLevel; maxEntries?: number }) => LogEntry[]
}
