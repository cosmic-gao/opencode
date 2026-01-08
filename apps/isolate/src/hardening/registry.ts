export interface HardeningRegistry {
  prototypes: Constructor[];
  builtins: string[];
  globals: string[];
  symbols: symbol[];
  typedArrays: Constructor[];
}
type Constructor = { prototype: object; name?: string };
function exists(name: string): boolean {
  try {
    return typeof (globalThis as Record<string, unknown>)[name] !== 'undefined';
  } catch {
    return false;
  }
}
export function prototypes(): Constructor[] {
  const core = [
    Object,
    Array,
    Function,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Error,
    Map,
    Set,
    Promise,
  ];
  const extended: Constructor[] = [];
  if (exists('BigInt')) {
    extended.push(BigInt as Constructor);
  }
  if (exists('ArrayBuffer')) {
    extended.push(ArrayBuffer as Constructor);
  }
  if (exists('SharedArrayBuffer')) {
    extended.push(SharedArrayBuffer as Constructor);
  }
  if (exists('DataView')) {
    extended.push(DataView as Constructor);
  }
  const typedArrays = [
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',
  ];
  for (const name of typedArrays) {
    if (exists(name)) {
      const ctor = (globalThis as unknown as Record<string, unknown>)[name] as Constructor;
      if (ctor && ctor.prototype) extended.push(ctor);
    }
  }
  if (exists('WeakRef')) {
    extended.push(WeakRef as Constructor);
  }
  if (exists('FinalizationRegistry')) {
    extended.push(FinalizationRegistry as Constructor);
  }
  if (exists('AggregateError')) {
    extended.push(AggregateError as Constructor);
  }
  return [...core, ...extended];
}
export function builtins(): string[] {
  const core = [
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
  ];
  const extended: string[] = [];
  if (exists('Intl')) {
    extended.push('Intl');
  }
  if (exists('WebAssembly')) {
    extended.push('WebAssembly');
  }
  if (exists('Atomics')) {
    extended.push('Atomics');
  }
  if (exists('BigInt')) {
    extended.push('BigInt');
  }
  return [...core, ...extended];
}
export function globals(): string[] {
  const dangerous = [
    'eval',
    'Function',
    'AsyncFunction',
    'GeneratorFunction',
    'AsyncGeneratorFunction',
  ];
  const extended: string[] = [];
  if (exists('Deno')) {
    extended.push('Deno');
  }
  if (exists('process')) {
    extended.push('process');
  }
  if (exists('require')) {
    extended.push('require');
  }
  if (exists('global')) {
    extended.push('global');
  }
  if (exists('module')) {
    extended.push('module');
  }
  if (exists('exports')) {
    extended.push('exports');
  }
  if (exists('__dirname')) {
    extended.push('__dirname');
  }
  if (exists('__filename')) {
    extended.push('__filename');
  }
  return [...dangerous, ...extended];
}
export function symbols(): symbol[] {
  const wellKnown: symbol[] = [
    Symbol.iterator,
    Symbol.asyncIterator,
    Symbol.toStringTag,
    Symbol.hasInstance,
    Symbol.isConcatSpreadable,
    Symbol.toPrimitive,
    Symbol.species,
    Symbol.match,
    Symbol.replace,
    Symbol.search,
    Symbol.split,
    Symbol.unscopables,
  ];
  return wellKnown.filter(s => s !== undefined);
}
export function typedArrays(): Constructor[] {
  const names = [
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',
  ];
  return names
    .filter(name => exists(name))
    .map(name => (globalThis as unknown as Record<string, unknown>)[name] as Constructor)
    .filter((ctor): ctor is Constructor => ctor !== undefined && ctor.prototype !== undefined);
}
export function registry(): HardeningRegistry {
  return {
    prototypes: prototypes(),
    builtins: builtins(),
    globals: globals(),
    symbols: symbols(),
    typedArrays: typedArrays(),
  };
}
