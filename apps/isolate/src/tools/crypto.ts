import type { Tool } from './types.ts'

export const crypto: Tool = {
  name: 'crypto',
  description: 'Web Crypto API',
  setup: (globals) => {
    if (typeof globalThis.crypto === 'undefined' && typeof self.crypto !== 'undefined') {
      globals.crypto = self.crypto
    }
  },
}
