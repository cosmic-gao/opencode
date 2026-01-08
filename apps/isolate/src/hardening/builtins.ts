import { builtins as getBuiltins } from './registry.ts';
export interface HardenResult {
  success: boolean;
  target: string;
  error?: Error;
}
function hardenOne(obj: object, name: string): HardenResult {
  try {
    if (Object.isFrozen(obj)) {
      return { success: true, target: name };
    }
    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.getOwnPropertyNames(obj);
      for (const key of keys) {
        try {
          const value = (obj as Record<string, unknown>)[key];
          if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            Object.freeze(value);
          }
        } catch {
          // ignore
        }
      }
    }
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    for (const key of Object.keys(descriptors)) {
      const desc = descriptors[key];
      if (desc.configurable) {
        try {
          Object.defineProperty(obj, key, {
            ...desc,
            configurable: false,
            writable: desc.writable !== undefined ? false : desc.writable,
          });
        } catch {
          // ignore
        }
      }
    }
    Object.freeze(obj);
    if (!Object.isFrozen(obj)) {
      throw new Error('Failed to freeze builtin');
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
export function harden(): HardenResult[] {
  const builtinNames = getBuiltins();
  const results: HardenResult[] = [];
  const critical = ['Object', 'Reflect'];
  for (const name of critical) {
    if (builtinNames.includes(name)) {
      const obj = (globalThis as Record<string, unknown>)[name];
      if (obj && typeof obj === 'object') {
        const result = hardenOne(obj as object, name);
        results.push(result);
      }
    }
  }
  for (const name of builtinNames) {
    if (critical.includes(name)) {
      continue; // 已处理
    }
    try {
      const obj = (globalThis as Record<string, unknown>)[name];
      if (!obj) {
        results.push({
          success: false,
          target: name,
          error: new Error('Builtin not found'),
        });
        continue;
      }
      if (typeof obj === 'function') {
        const result = hardenOne(obj as object, name);
        results.push(result);
      } else if (typeof obj === 'object') {
        const result = hardenOne(obj, name);
        results.push(result);
      }
    } catch (error) {
      results.push({
        success: false,
        target: name,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  return results;
}
export function verify(): boolean {
  const builtinNames = getBuiltins();
  for (const name of builtinNames) {
    try {
      const obj = (globalThis as Record<string, unknown>)[name];
      if (!obj) {
        continue; // 环境中不存在该对象，跳过
      }
      if (!Object.isFrozen(obj)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}
export function detect(): string[] {
  const builtinNames = getBuiltins();
  const tampered: string[] = [];
  for (const name of builtinNames) {
    try {
      const obj = (globalThis as Record<string, unknown>)[name];
      if (!obj) {
        continue;
      }
      const desc = Object.getOwnPropertyDescriptor(globalThis, name);
      if (desc && (desc.writable || desc.configurable)) {
        tampered.push(`${name} is writable or configurable`);
      }
      if (typeof obj === 'function') {
        const funcStr = obj.toString();
        if (!funcStr.includes('[native code]') && !funcStr.includes('class')) {
          tampered.push(`${name} may be replaced (not native code)`);
        }
      }
    } catch {
      // ignore
    }
  }
  return tampered;
}
