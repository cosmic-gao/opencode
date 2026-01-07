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
