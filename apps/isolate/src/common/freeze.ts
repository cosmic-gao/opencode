interface FreezeOptions {
  prototypes?: boolean;
  builtins?: boolean;
  deno?: boolean;
}

function freezePrototypes(): void {
  const prototypes = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
    String.prototype,
    Number.prototype,
    Boolean.prototype,
    Date.prototype,
    RegExp.prototype,
    Error.prototype,
    Map.prototype,
    Set.prototype,
    Promise.prototype,
  ];

  for (const proto of prototypes) {
    try {
      Object.freeze(proto);
    } catch {
      // ignore
    }
  }
}

function freezeBuiltins(): void {
  const builtins = [
    'Object',
    'Array',
    'Function',
    'String',
    'Number',
    'Boolean',
    'Date',
    'RegExp',
    'Error',
    'Math',
    'JSON',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Promise',
    'Symbol',
    'Proxy',
    'Reflect',
  ] as const;

  for (const name of builtins) {
    try {
      const obj = (globalThis as Record<string, unknown>)[name];
      if (obj && typeof obj === 'object') {
        Object.freeze(obj);
      }
    } catch {
      // ignore
    }
  }
}

function freezeDeno(): void {
  if (typeof Deno !== 'undefined') {
    try {
      Object.freeze(Deno.permissions);
      
      const denoProps = Object.getOwnPropertyNames(Deno);
      for (const prop of denoProps) {
        if (prop !== 'env') {
          try {
            const desc = Object.getOwnPropertyDescriptor(Deno, prop);
            if (desc && desc.configurable) {
              Object.defineProperty(Deno, prop, {
                ...desc,
                writable: false,
                configurable: false,
              });
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

export function freeze(options: FreezeOptions = {}): void {
  const {
    prototypes = true,
    builtins = true,
    deno = true,
  } = options;

  if (prototypes) {
    freezePrototypes();
  }

  if (builtins) {
    freezeBuiltins();
  }

  if (deno) {
    freezeDeno();
  }
}

export function isFrozen(obj: object): boolean {
  return Object.isFrozen(obj);
}

export function verifyFreeze(): boolean {
  const criticalPrototypes = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
  ];

  return criticalPrototypes.every(proto => Object.isFrozen(proto));
}
