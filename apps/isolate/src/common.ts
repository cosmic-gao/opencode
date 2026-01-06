import { ensure } from 'errorish';
import type { Fault, Registry, Tool } from './types.ts';

export interface ProxyOptions<T extends object> {
  whitelist: string[];
  validator?: (prop: string, args: unknown[]) => void;
  interceptor?: (prop: string, value: unknown) => unknown;
  readonly?: boolean;
}

function normalize<T extends object>(options: string[] | ProxyOptions<T>): ProxyOptions<T> {
  return Array.isArray(options) ? { whitelist: options } : options;
}

export function proxy<T extends object>(
  target: T,
  options: string[] | ProxyOptions<T>,
): T {
  const config = normalize(options);

  const allowed = new Set(config.whitelist);

  return new Proxy(target, {
    get(t, p: string | symbol) {
      if (typeof p === 'symbol') return Reflect.get(t, p);
      if (!allowed.has(p)) return undefined;

      const value = Reflect.get(t, p);

      if (config.interceptor) {
        return config.interceptor(p, value);
      }

      if (typeof value === 'function' && config.validator) {
        return new Proxy(value, {
          apply(fn, thisArg, args) {
            config.validator!(p, args);
            return Reflect.apply(fn, thisArg, args);
          },
        });
      }

      return value;
    },

    set(t, p: string | symbol, v) {
      if (config.readonly) {
        throw new Error('Object is readonly');
      }
      if (typeof p === 'symbol' || !allowed.has(p)) {
        return false;
      }
      return Reflect.set(t, p, v);
    },

    deleteProperty(_t, _p: string | symbol) {
      if (config.readonly) {
        throw new Error('Object is readonly');
      }
      return false;
    },

    getOwnPropertyDescriptor(t, p: string | symbol) {
      if (typeof p === 'symbol') return Reflect.getOwnPropertyDescriptor(t, p);
      if (allowed.has(p)) return Reflect.getOwnPropertyDescriptor(t, p);
      return undefined;
    },

    has(t, p: string | symbol) {
      if (typeof p === 'symbol') return Reflect.has(t, p);
      return allowed.has(p);
    },

    ownKeys(t) {
      return Reflect.ownKeys(t).filter((key) => typeof key === 'symbol' || allowed.has(key));
    },
  });
}

export function read<T extends object>(target: T, name: string): T {
  return new Proxy(target, {
    set() {
      throw new Error(`Property "${name}" is read-only`);
    },
    deleteProperty() {
      throw new Error(`Property "${name}" is read-only`);
    },
  });
}

export function lazy<T extends object>(
  factory: () => Promise<T>,
): T {
  let instance: T | null = null;
  let loading: Promise<T> | null = null;

  const ensure = async (): Promise<T> => {
    if (instance) return instance;
    if (loading) return loading;

    loading = factory();
    instance = await loading;
    loading = null;
    return instance;
  };

  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;

      return new Proxy({}, {
        get(_t, method: string | symbol) {
          if (typeof method === 'symbol') return undefined;

          return (...args: unknown[]) => {
            return ensure().then((obj) => {
              const table = (obj as Record<string, unknown>)[prop] as
                | Record<string, unknown>
                | undefined;
              if (!table || typeof table[method as string] !== 'function') {
                throw new Error(`Invalid operation: ${String(prop)}.${String(method)}`);
              }
              return (table[method as string] as (...args: unknown[]) => unknown)(...args);
            });
          };
        },
      });
    },
  });
}

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

export function registry(items: Tool[]): Registry {
  const result: Registry = {};
  for (const tool of items) {
    result[tool.name] = tool;
  }
  return result;
}

export function setup(items: Tool[], globals: Record<string, unknown>): void {
  for (const tool of items) {
    tool.setup(globals);
  }
}

export async function install(scope: Record<string, unknown>, tools: Tool[]): Promise<string[]> {
  const installed: string[] = [];
  try {
    for (const tool of tools) {
      await tool.setup(scope);
      installed.push(tool.name);
    }
    return installed;
  } catch (error) {
    for (const name of installed) {
      try {
        delete scope[name];
      } catch {
        // ignore
      }
    }
    throw error;
  }
}

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

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

export function bootstrap(
  scope: Record<string, unknown>,
  items: Tool[],
  names: string[] = [],
  globals: Record<string, unknown> = {},
): void {
  const index = registry(items);
  const initializing = new Set<string>();
  const cache = new Map<string, unknown>();

  for (const name of names) {
    const tool = index[name];
    if (!tool) continue;

    Object.defineProperty(scope, name, {
      get() {
        if (cache.has(name)) {
          return cache.get(name);
        }

        if (initializing.has(name)) {
          throw new Error(`Circular dependency detected: ${[...initializing, name].join(' -> ')}`);
        }

        initializing.add(name);

        try {
          const instance = tool.setup(scope) ?? undefined; // setup 返回实例
          if (instance === undefined) {
            throw new Error(`Tool "${name}" did not provide an instance`);
          }

          cache.set(name, instance);
          initializing.delete(name);

          return instance;
        } catch (error) {
          initializing.delete(name);
          throw error; // 不缓存失败，方便重试
        }
      },
      set() {
        throw new Error(`Cannot set tool: ${name}`);
      },
      enumerable: true,
      configurable: true,
    });
  }

  provide(scope, globals); // 直接注入 globals
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
