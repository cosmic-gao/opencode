import { ensure } from 'errorish';
import type { Fault } from '../types.ts';

export function fault(error: unknown): Fault {
  const err = ensure(error);
  const cleanStack = err.stack
    ?.split('\n')
    .map((line) => {
      return line
        .replace(/file:\/\/\/[A-Z]:\/[^\s)]+/g, '[isolate]')
        .replace(/https?:\/\/[^\s)]+/g, '[external]');
    })
    .join('\n');

  return {
    name: err.name,
    message: err.message,
    stack: cleanStack,
  };
}

export function bust(url: string): string {
  if (url.startsWith('data:')) {
    return url;
  }
  const now = Date.now().toString(36);
  const suffix = url.includes('?') ? '&' : '?';
  return url + suffix + 'v=' + now;
}

export function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
    } catch {
      return String(value);
    }
  }
}
