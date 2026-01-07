import type { Entry, Fault, Level, Output, Packet } from './types.ts';
import { build } from './tools/index.ts';
import { mount, bust, fault, reset, stringify, unmount, index } from './common/index.ts';
import { Pool } from './pool.ts';
import type { PoolAPI } from './pool.ts';

self.postMessage({ type: 'log', data: { level: 'info', message: '[worker] Worker script loaded', timestamp: Date.now() } });

const tools = build();

const pool = new Pool({
  limit: 50,
  options: {
    max: 10,
    idle_timeout: 120,
    connect_timeout: 10,
    max_lifetime: 3600,
  },
  cleanupInterval: 60_000,
  idleTimeout: 120_000,
});

pool.init();

const poolAPI: PoolAPI = {
  get: (url: string) => pool.get(url),
  release: (url: string) => pool.release(url),
  stats: () => pool.stats(),
  size: () => pool.size,
  healthCheck: () => pool.healthCheck(),
};

function capture(level: Level) {
  return (...args: unknown[]) => {
    const msg = args
      .map((x) => (typeof x === 'string' ? x : stringify(x)))
      .join(' ');

    const log: Entry = {
      level,
      message: msg,
      timestamp: Date.now(),
    };

    self.postMessage({ type: 'log', data: log });
  };
}

console.log = capture('log');
console.info = capture('info');
console.warn = capture('warn');
console.error = capture('error');

function error(err: Fault): Entry {
  return {
    level: 'exception',
    message: err.message,
    name: err.name,
    stack: err.stack,
    timestamp: Date.now(),
  };
}

self.addEventListener('error', (event: ErrorEvent) => {
  event.preventDefault();
  const log = error(fault(event.error));
  self.postMessage({ type: 'log', data: log });
});

self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  event.preventDefault();
  const log = error(fault(event.reason));
  self.postMessage({ type: 'log', data: log });
});

function entry(
  module: Record<string, unknown>,
  name: string,
): (input: unknown) => unknown | Promise<unknown> {
  const fn = module[name];
  if (typeof fn !== 'function') {
    const err: Fault = { name: 'EntryError', message: `Entry "${name}" is not a function` };
    throw err;
  }
  return fn as (input: unknown) => unknown | Promise<unknown>;
}

async function run(packet: Packet): Promise<Output> {
  const start = performance.now();
  const scope = globalThis as Record<string, unknown>;
  const names = packet.tools || [];
  const registry = index(tools);
  const selected = names.map(name => registry[name]).filter(Boolean);

  try {
    // Add pool to scope for db tool
    scope.__pool__ = poolAPI;
    
    await mount(scope, tools, names, packet.globals);

    const url = bust(packet.url);
    const mod = await import(url);

    const fn = entry(mod as Record<string, unknown>, packet.entry);
    const out = await fn(packet.input);

    return {
      ok: true,
      result: out,
      duration: Math.round(performance.now() - start),
    };
  } catch (e) {
    const err = fault(e);

    const log: Entry = {
      level: 'exception',
      message: err.message,
      name: err.name,
      stack: err.stack,
      timestamp: Date.now(),
    };
    self.postMessage({ type: 'log', data: log });

    return {
      ok: false,
      duration: Math.round(performance.now() - start),
    };
  } finally {
    await unmount(scope, selected);
    reset(scope, names);
  }
}

self.addEventListener('message', async (event: MessageEvent) => {
  const data = event.data;

  if (!data || typeof data !== 'object' || !data.url) {
    return;
  }

  const out = await run(data as Packet);
  self.postMessage({ type: 'result', data: out });
});
