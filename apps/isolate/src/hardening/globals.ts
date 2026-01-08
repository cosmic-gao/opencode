import { globals as getGlobals, symbols as getSymbols } from './registry.ts';
export interface HardenResult {
  success: boolean;
  target: string;
  error?: Error;
}
function lockGlobal(name: string): HardenResult {
  try {
    const value = (globalThis as Record<string, unknown>)[name];
    if (value === undefined) {
      return { success: true, target: name }; // 不存在，无需处理
    }
    if (typeof value === 'object' && value !== null) {
      Object.freeze(value);
    }
    const desc = Object.getOwnPropertyDescriptor(globalThis, name);
    if (desc && (desc.configurable || desc.writable)) {
      Object.defineProperty(globalThis, name, {
        value: value,
        writable: false,
        configurable: false,
        enumerable: desc.enumerable,
      });
    }
    return { success: true, target: name };
  } catch (error) {
    return {
      success: false,
      target: name,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
function lockSymbols(): HardenResult[] {
  const symbolList = getSymbols();
  const results: HardenResult[] = [];
  for (const sym of symbolList) {
    try {
      const desc = Object.getOwnPropertyDescriptor(Symbol, sym.toString());
      if (desc && (desc.configurable || desc.writable)) {
        Object.defineProperty(Symbol, sym.toString(), {
          ...desc,
          writable: false,
          configurable: false,
        });
      }
      results.push({
        success: true,
        target: `Symbol.${sym.description || sym.toString()}`,
      });
    } catch (error) {
      results.push({
        success: false,
        target: `Symbol.${sym.description || 'unknown'}`,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  return results;
}
function sealGlobalThis(): HardenResult {
  try {
    if (!Object.isSealed(globalThis)) {
      Object.preventExtensions(globalThis);
    }
    return { success: true, target: 'globalThis' };
  } catch (error) {
    return {
      success: false,
      target: 'globalThis',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
export function harden(): HardenResult[] {
  const globalNames = getGlobals();
  const results: HardenResult[] = [];
  for (const name of globalNames) {
    const result = lockGlobal(name);
    results.push(result);
  }
  const symbolResults = lockSymbols();
  results.push(...symbolResults);
  return results;
}
export function verify(): boolean {
  const globalNames = getGlobals();
  for (const name of globalNames) {
    try {
      const desc = Object.getOwnPropertyDescriptor(globalThis, name);
      if (!desc) {
        continue; // 不存在
      }
      if (desc.configurable || desc.writable) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}
export function detect(): string[] {
  const unauthorized: string[] = [];
  const globalKeys = Object.getOwnPropertyNames(globalThis);
  const knownGlobals = new Set([
    'Object', 'Array', 'Function', 'String', 'Number', 'Boolean',
    'Date', 'RegExp', 'Error', 'Math', 'JSON',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
    'Symbol', 'Proxy', 'Reflect',
    'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
    'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
    'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
    'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
    'Atomics', 'BigInt', 'Intl', 'WebAssembly',
    'undefined', 'NaN', 'Infinity', 'isNaN', 'isFinite',
    'parseInt', 'parseFloat', 'encodeURI', 'decodeURI',
    'encodeURIComponent', 'decodeURIComponent',
    'eval', 'globalThis', 'self',
    'Deno', 'process', 'global', 'require', 'module', 'exports',
    '__dirname', '__filename',
    'postMessage', 'addEventListener', 'removeEventListener',
    'onmessage', 'onerror', 'onmessageerror',
    'close', 'name', 'location', 'navigator',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'queueMicrotask',
    'console',
    'crypto', 'fetch', 'Response', 'Request', 'Headers',
    'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder',
    'AbortController', 'AbortSignal',
  ]);
  for (const key of globalKeys) {
    if (knownGlobals.has(key)) {
      continue;
    }
    if (key.startsWith('__')) {
      continue;
    }
    const desc = Object.getOwnPropertyDescriptor(globalThis, key);
    if (desc && desc.configurable) {
      unauthorized.push(`Unauthorized global: ${key}`);
    }
  }
  return unauthorized;
}
