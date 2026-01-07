import type { CryptoToolConfig, Tool, Perms } from '../types.ts';
import { inject, proxy } from '../common/index.ts';

export interface CryptoConfig extends CryptoToolConfig {
  permissions?: Perms;
}

function validator(config: CryptoToolConfig | undefined) {
  let count = 0;
  const limit = 1000;

  return (prop: string, args: unknown[]) => {
    if (++count > limit) {
      throw new Error(`Crypto operation limit exceeded (max ${limit})`);
    }

    if (prop === 'getRandomValues') {
      const max = config?.limit ?? 65536;
      const array = args[0] as { byteLength?: number };
      if (array?.byteLength && array.byteLength > max) {
        throw new Error(`Array too large (max ${max} bytes)`);
      }
    }
  };
}

export function crypto(config?: CryptoConfig): Tool {
  return {
    name: 'crypto',
    permissions: config?.permissions || "none",
    config,
    setup: (globals) => {
      if (typeof self.crypto === 'undefined') return;

      const defaults = ['getRandomValues', 'randomUUID'];
      if (config?.subtle !== false) {
        defaults.push('subtle');
      }

      const safe = proxy(self.crypto, {
        whitelist: config?.methods ?? defaults,
        validator: validator(config)
      });

      inject(globals, 'crypto', safe);
    },
  };
}

export default crypto();
