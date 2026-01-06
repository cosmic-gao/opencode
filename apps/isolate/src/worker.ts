import type { Fault, LogEntry, LogLevel, Output, Packet } from './types.ts';
import { ensure } from 'errorish';

function normalize(error: unknown): Fault {
  const err = ensure(error);
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

function capture(level: LogLevel) {
  return (...args: unknown[]) => {
    const msg = args
      .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
      .join(' ');

    const log: LogEntry = {
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
  const log: LogEntry = {
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
  const log: LogEntry = {
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
    const mod = await import(packet.url);
    const fn = pick(mod as Record<string, unknown>, packet.entry);
    const out = await fn(packet.input);

    return {
      ok: true,
      result: out,
      duration: Math.round(performance.now() - start),
    };
  } catch (e) {
    const err = normalize(e);

    const log: LogEntry = {
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
  const out = await run(event.data as Packet);
  self.postMessage({ type: 'result', data: out });
});
