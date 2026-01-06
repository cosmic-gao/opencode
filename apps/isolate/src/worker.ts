import type { Entry, Fault, Level, Output, Packet } from './types.ts';
import { tools } from './tools/index.ts';
import { bootstrap, bust, normalize, stringify } from './common.ts';

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

self.addEventListener('error', (event: ErrorEvent) => {
  event.preventDefault();
  const err = normalize(event.error);
  const log: Entry = {
    level: 'exception',
    message: err.message,
    name: err.name,
    stack: err.stack,
    timestamp: Date.now(),
  };
  self.postMessage({ type: 'log', data: log });
});

self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  event.preventDefault();
  const err = normalize(event.reason);
  const log: Entry = {
    level: 'exception',
    message: err.message,
    name: err.name,
    stack: err.stack,
    timestamp: Date.now(),
  };
  self.postMessage({ type: 'log', data: log });
});

function pick(
  module: Record<string, unknown>,
  entry: string,
): (input: unknown) => unknown | Promise<unknown> {
  const fn = module[entry];
  if (typeof fn !== 'function') {
    const err: Fault = { name: 'EntryError', message: `Entry "${entry}" is not a function` };
    throw err;
  }
  return fn as (input: unknown) => unknown | Promise<unknown>;
}

async function run(packet: Packet): Promise<Output> {
  const start = performance.now();

  try {
    bootstrap(globalThis as Record<string, unknown>, tools, packet.tools, packet.globals);

    const url = bust(packet.url);
    const mod = await import(url)
    
    const fn = pick(mod as Record<string, unknown>, packet.entry);
    const out = await fn(packet.input);

    return {
      ok: true,
      result: out,
      duration: Math.round(performance.now() - start),
    };
  } catch (e) {
    const err = normalize(e);

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
