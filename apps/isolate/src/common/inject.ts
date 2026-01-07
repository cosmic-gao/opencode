const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

const GLOBALS = new Set([
  'self',
  'globalThis',
  'console',
  'performance',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'Math',
  'JSON',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Symbol',
  'Proxy',
  'Reflect',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'TextEncoder',
  'TextDecoder',
  'Uint8Array',
  'ArrayBuffer',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask',
  'structuredClone',
  'atob',
  'btoa',
]);

const TRACKED = new WeakMap<Record<string, unknown>, Set<string>>();

export function inject(
  scope: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  const desc = Object.getOwnPropertyDescriptor(scope, name);
  if (desc && !desc.configurable) return;

  Object.defineProperty(scope, name, {
    value,
    writable: false,
    enumerable: true,
    configurable: false,
  });
}

export function provide(scope: Record<string, unknown>, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN.has(key)) {
      throw new Error(`Forbidden key: ${key}`);
    }
    if (typeof key !== 'string' || key.includes('.')) {
      throw new Error('Invalid key');
    }
    inject(scope, key, value);
    track(scope, key);
  }
}

export function track(scope: Record<string, unknown>, key: string): void {
  let keys = TRACKED.get(scope);
  if (!keys) {
    keys = new Set();
    TRACKED.set(scope, keys);
  }
  keys.add(key);
}

export function reset(
  scope: Record<string, unknown>,
  tools: string[] = [],
): void {
  const tracked = TRACKED.get(scope);
  const toolSet = new Set(tools || []);

  if (tracked && tracked.size > 0) {
    for (const key of tracked) {
      if (!GLOBALS.has(key) && !toolSet.has(key)) {
        const desc = Object.getOwnPropertyDescriptor(scope, key);
        if (desc && desc.configurable) {
          try {
            delete scope[key];
          } catch {
            // ignore
          }
        }
      }
    }
    tracked.clear();
  }
}
