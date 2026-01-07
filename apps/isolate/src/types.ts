import type { AnyHook, AsyncHook, Hooks, Plugin, SyncHook } from '@opencode/plugable';

export type Perms = "none" | {
  env?: string[];
  net?: string[];
  read?: string[];
  write?: string[];
  run?: string[];
  ffi?: string[];
  hrtime?: boolean;
};

export interface Tool {
  name: string;
  setup: (globals: Record<string, unknown>) => void | Promise<void>;
  teardown?: (globals: Record<string, unknown>) => void | Promise<void>;
  permissions?: Perms | ((ctx: Context) => Perms);
  config?: unknown;
}

export interface Registry {
  [name: string]: Tool;
}

export type Fault = { name: string; message: string; stack?: string };

export type Level = 'log' | 'info' | 'warn' | 'error' | 'exception';

export type Entry = {
  level: Level;
  message: string;
  timestamp: number;
  name?: string;
  stack?: string;
};

export type Output = {
  ok: boolean;
  result?: unknown;
  logs?: readonly Entry[];
  duration: number;
};

export interface Request {
  readonly code: string;
  readonly input?: unknown;
  readonly entry?: string;
  readonly timeout?: number;
  readonly permissions?: Deno.PermissionOptions;
  readonly tools?: string[];
}

export type Reply = Output;

export interface Packet {
  readonly code: string;
  readonly input: unknown;
  readonly entry: string;
  readonly url: string;
  readonly globals?: Record<string, unknown>;
  readonly tools?: string[];
}

export interface Config {
  readonly maxSize: number;
  readonly timeout: number;
  readonly port: number;
  readonly crypto?: CryptoToolConfig;
  readonly strict?: boolean;
  readonly audit?: boolean;
}

export interface CryptoToolConfig {
  subtle?: boolean;
  limit?: number;
  methods?: string[];
}

export interface Context {
  config: Config;
  request: Request;
  url: string;
  output: Output | null;
  globals?: Record<string, unknown>;
  tools?: string[];
  permissions?: Deno.PermissionOptions;
}

export interface ChannelMessage<T = unknown> {
  type: 'channel';
  topic: string;
  data: T;
  sender?: string;
  timestamp: number;
}

export interface IsolateHooks extends Hooks {
  onValidate: AsyncHook<Request>;
  onLoad: AsyncHook<Context>;
  onSpawn: SyncHook<Process>;
  onExecute: AsyncHook<Context>;
  onFormat: AsyncHook<Output>;
  [key: string]: AnyHook;
}

export type IsolatePlugin = Plugin<IsolateHooks, Context>;

export interface Process {
  readonly worker: Worker;
  kill: () => void;
}

export interface Runner {
  run: (
    request: Request,
    url: string,
    globals?: Record<string, unknown>,
    tools?: string[],
  ) => Promise<Output>;
}

export interface Factory {
  spawn: (permissions?: Deno.PermissionOptions) => Process;
  runner: (proc: Process, timeout: number) => Runner;
}

export interface Logger {
  filter: (logs: readonly Entry[], options?: { minLevel?: Level; maxEntries?: number }) => Entry[];
}

export interface Toolset {
  tools: () => Tool[];
  registry: () => Registry;
  setup: (tools: Tool[], globals: Record<string, unknown>) => void;
}


