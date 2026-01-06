import type { CryptoToolConfig, Tool } from '../types.ts';
import { inject, proxy } from '../common.ts';

export function createCrypto(config?: CryptoToolConfig): Tool {
  return {
    name: 'crypto',
    setup: (globals) => {
      if (typeof self.crypto === 'undefined') {
        return;
      }

      const defaults = ['getRandomValues', 'randomUUID'];
      if (config?.subtle !== false) {
        defaults.push('subtle');
      }

      const safe = proxy(self.crypto, {
        whitelist: config?.methods ?? defaults,
        validator: (prop, args) => {
          if (prop === 'getRandomValues') {
            const limit = config?.limit ?? 65536;
            const array = args[0] as { byteLength?: number };
            if (array?.byteLength && array.byteLength > limit) {
              throw new Error(`Array too large (max ${limit} bytes)`);
            }
          }
        }
      });

      inject(globals, 'crypto', safe);
    },
  };
}

export const crypto = createCrypto();
