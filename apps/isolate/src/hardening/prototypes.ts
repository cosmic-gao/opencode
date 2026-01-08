import { prototypes as getPrototypes } from './registry.ts';
type Constructor = { prototype: object; name?: string };
export interface HardenResult {
  success: boolean;
  target: string;
  error?: Error;
}
function hardenOne(proto: object, name: string): HardenResult {
  try {
    if (Object.isFrozen(proto)) {
      return { success: true, target: name };
    }
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    for (const key of Object.keys(descriptors)) {
      const desc = descriptors[key];
      if (desc.configurable) {
        try {
          Object.defineProperty(proto, key, {
            ...desc,
            configurable: false,
          });
        } catch (_err) {
          // ignore
        }
      }
    }
    Object.freeze(proto);
    if (!Object.isFrozen(proto)) {
      throw new Error('Failed to freeze prototype');
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
  const protoList = getPrototypes();
  const results: HardenResult[] = [];
  for (const ctor of protoList) {
    try {
      const proto = ctor.prototype;
      const ctorWithName = ctor as Constructor & { name?: string };
      const name = ctorWithName.name || 'Unknown';
      const ctorResult = hardenOne(ctor as object, `${name}.constructor`);
      results.push(ctorResult);
      if (proto && typeof proto === 'object') {
        const protoResult = hardenOne(proto, `${name}.prototype`);
        results.push(protoResult);
      }
    } catch (error) {
      const ctorWithName = ctor as Constructor & { name?: string };
      results.push({
        success: false,
        target: ctorWithName.name || 'Unknown',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  return results;
}
export function verify(): boolean {
  const protoList = getPrototypes();
  for (const ctor of protoList) {
    try {
      const proto = ctor.prototype;
      if (!Object.isFrozen(ctor)) {
        return false;
      }
      if (proto && typeof proto === 'object' && !Object.isFrozen(proto)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}
export function detect(): string[] {
  const protoList = getPrototypes();
  const polluted: string[] = [];
  for (const ctor of protoList) {
    try {
      const proto = ctor.prototype as Record<string, unknown>;
      const ctorWithName = ctor as Constructor & { name?: string };
      const name = ctorWithName.name || 'Unknown';
      const ownKeys = Object.getOwnPropertyNames(proto);
      const suspiciousKeys = ownKeys.filter(key => {
        const isStandard = key === 'constructor' ||
          key.startsWith('__') ||
          typeof proto[key] === 'function';
        return !isStandard && proto[key] !== undefined;
      });
      if (suspiciousKeys.length > 0) {
        polluted.push(
          `${name}.prototype has suspicious keys: ${suspiciousKeys.join(', ')}`
        );
      }
    } catch {
      // ignore
    }
  }
  return polluted;
}
