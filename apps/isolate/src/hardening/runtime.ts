export interface HardenResult {
  success: boolean;
  target: string;
  error?: Error;
}
function hardenDeno(): HardenResult[] {
  const results: HardenResult[] = [];
  if (typeof Deno === 'undefined') {
    return results;
  }
  try {
    if (Deno.permissions) {
      Object.freeze(Deno.permissions);
      results.push({ success: true, target: 'Deno.permissions' });
    }
    if (Deno.env) {
      const envSnapshot = Object.freeze(Deno.env.toObject());
      const readonlyEnv = Object.freeze({
        get: (key: string) => envSnapshot[key],
        has: (key: string) => key in envSnapshot,
        toObject: () => Object.freeze({ ...envSnapshot }),
        set: () => {
          throw new Error('Deno.env is readonly in sandbox');
        },
        delete: () => {
          throw new Error('Deno.env is readonly in sandbox');
        },
      });
      Object.defineProperty(Deno, 'env', {
        value: readonlyEnv,
        writable: false,
        configurable: false,
        enumerable: true,
      });
      results.push({ success: true, target: 'Deno.env' });
    }
    if ('core' in Deno) {
      try {
        const core = (Deno as Record<string, unknown>).core;
        if (core && typeof core === 'object') {
          Object.freeze(core);
          Object.defineProperty(Deno, 'core', {
            value: core,
            writable: false,
            configurable: false,
          });
        }
        results.push({ success: true, target: 'Deno.core' });
      } catch (error) {
        results.push({
          success: false,
          target: 'Deno.core',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
    const denoProps = Object.getOwnPropertyNames(Deno);
    let lockedCount = 0;
    const errors: string[] = [];
    for (const prop of denoProps) {
      if (prop === 'env') {
        continue;
      }
      try {
        const desc = Object.getOwnPropertyDescriptor(Deno, prop);
        if (desc && desc.configurable) {
          Object.defineProperty(Deno, prop, {
            ...desc,
            configurable: false,
            writable: false,
          });
          lockedCount++;
        }
      } catch (error) {
        errors.push(`${prop}: ${error}`);
      }
    }
    results.push({
      success: errors.length === 0,
      target: `Deno.* (${lockedCount} properties)`,
      error: errors.length > 0 ? new Error(errors.join('; ')) : undefined,
    });
    Object.freeze(Deno);
    results.push({ success: true, target: 'Deno (namespace)' });
  } catch (error) {
    results.push({
      success: false,
      target: 'Deno',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
  return results;
}
function hardenNode(): HardenResult[] {
  const results: HardenResult[] = [];
  const proc = (globalThis as unknown as { process?: unknown }).process as {
    env: Record<string, string | undefined>;
    [key: string]: unknown;
  } | undefined;
  if (typeof proc === 'undefined') {
    return results;
  }
  try {
    if (proc.env) {
      const envSnapshot = Object.freeze({ ...proc.env });
      const readonlyEnv = new Proxy(envSnapshot, {
        set: () => {
          throw new Error('process.env is readonly in sandbox');
        },
        deleteProperty: () => {
          throw new Error('process.env is readonly in sandbox');
        },
        defineProperty: () => {
          throw new Error('process.env is readonly in sandbox');
        },
      });
      Object.defineProperty(proc, 'env', {
        value: readonlyEnv,
        writable: false,
        configurable: false,
      });
      results.push({ success: true, target: 'process.env' });
    }
    const dangerousMethods = [
      'exit',
      'abort',
      'kill',
      'chdir',
      'setuid',
      'setgid',
      'setgroups',
    ];
    for (const method of dangerousMethods) {
      if (method in proc) {
        try {
          Object.defineProperty(proc, method, {
            value: () => {
              throw new Error(`process.${method} is disabled in sandbox`);
            },
            writable: false,
            configurable: false,
          });
          results.push({ success: true, target: `process.${method}` });
        } catch (error) {
          results.push({
            success: false,
            target: `process.${method}`,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }
    Object.freeze(proc);
    results.push({ success: true, target: 'process (object)' });
  } catch (error) {
    results.push({
      success: false,
      target: 'process',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
  return results;
}
export function harden(): HardenResult[] {
  const results: HardenResult[] = [];
  const denoResults = hardenDeno();
  const nodeResults = hardenNode();
  results.push(...denoResults, ...nodeResults);
  if (denoResults.length === 0 && nodeResults.length === 0) {
    results.push({
      success: true,
      target: 'runtime',
      error: new Error('No runtime detected (neither Deno nor Node.js)'),
    });
  }
  return results;
}
export function verify(): boolean {
  if (typeof Deno !== 'undefined') {
    if (!Object.isFrozen(Deno.permissions)) {
      return false;
    }
    try {
      Deno.env.set('__test__', 'value');
      return false;
    } catch {
      // ignore
    }
    if (!Object.isFrozen(Deno)) {
      return false;
    }
  }
  const proc = (globalThis as unknown as { process?: unknown }).process;
  if (typeof proc !== 'undefined') {
    try {
      (proc as { env: Record<string, unknown> }).env.__test__ = 'value';
      return false;
    } catch {
      // ignore
    }
    if (!Object.isFrozen(proc)) {
      return false;
    }
  }
  return true;
}
export function detect(): string[] {
  const issues: string[] = [];
  if (typeof Deno !== 'undefined') {
    try {
      const testKey = '__hardening_test__';
      Deno.env.set(testKey, 'test');
      issues.push('Deno.env is writable (should be readonly)');
      Deno.env.delete(testKey);
    } catch {
      // ignore
    }
    const desc = Object.getOwnPropertyDescriptor(Deno, 'permissions');
    if (desc && desc.configurable) {
      issues.push('Deno.permissions is configurable (should be locked)');
    }
  }
  const proc = (globalThis as unknown as { process?: unknown }).process;
  if (typeof proc !== 'undefined') {
    try {
      const procWithEnv = proc as { env: Record<string, unknown> };
      procWithEnv.env.__test__ = 'test';
      issues.push('process.env is writable (should be readonly)');
      delete procWithEnv.env.__test__;
    } catch {
      // ignore
    }
  }
  return issues;
}
