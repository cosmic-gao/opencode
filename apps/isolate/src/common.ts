import type { Fault, Registry, Tool } from './types.ts';

export function proxy<T extends object>(
  target: T,
  whitelist: string[],
): T {
  const allowed = new Set(whitelist);

  return new Proxy(target, {
    get(t, p: string | symbol) {
      if (typeof p === 'symbol') return Reflect.get(t, p);
      if (allowed.has(p)) return Reflect.get(t, p);
      return undefined;
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

export function inject(
  scope: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  Object.defineProperty(scope, name, {
    value,
    writable: false,
    enumerable: true,
    configurable: false,
  });
}

export function normalize(error: unknown): Fault {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
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

export function bootstrap(
  scope: Record<string, unknown>,
  items: Tool[],
  names: string[] = [],
  globals: Record<string, unknown> = {},
): void {
  const index = registry(items);

  for (const name of names) {
    const tool = index[name];
    if (tool) {
      tool.setup(scope);
    }
  }

  for (const [key, value] of Object.entries(globals)) {
    inject(scope, key, value);
  }
}
