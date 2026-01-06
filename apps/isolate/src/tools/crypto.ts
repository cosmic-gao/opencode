import type { Tool } from '../types.ts';
import { inject, proxy } from '../common.ts';

export const crypto: Tool = {
  name: 'crypto',
  setup: (globals) => {
    if (typeof self.crypto === 'undefined') {
      return;
    }

    const safe = proxy(
      self.crypto,
      ['getRandomValues', 'randomUUID'],
    );

    inject(globals, 'crypto', safe);
  },
};
