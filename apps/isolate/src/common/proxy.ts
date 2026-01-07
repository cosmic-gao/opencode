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
