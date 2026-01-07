import type { IsolatePlugin } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import { Pool } from '../pool.ts';
import type { PoolAPI } from '../pool.ts';

export const DatabasePlugin: IsolatePlugin = {
  name: 'opencode:database',
  pre: [],
  post: [],
  required: [],
  usePlugins: [],
  registryHook: {
    onPool: createAPIHook<PoolAPI>(),
  },

  setup(api) {
    if (!api.onPool) {
      throw new Error('onPool not registered');
    }

    const { config } = api.context();

    // Create pool with configuration
    const pool = new Pool({
      limit: 50,
      options: {
        max: 10,
        idle_timeout: 120,
        connect_timeout: 10,
        max_lifetime: 3600,
      },
      cleanupInterval: 60_000,
      idleTimeout: 120_000,
    });

    // Initialize pool
    pool.init();

    // Provide API
    const poolAPI: PoolAPI = {
      get: (url: string) => pool.get(url),
      release: (url: string) => pool.release(url),
      stats: () => pool.stats(),
      size: () => pool.size,
      healthCheck: () => pool.healthCheck(),
    };

    (api.onPool as APIHook<PoolAPI>).provide(poolAPI);

    // Health check on format (for monitoring)
    api.onFormat.tap((output) => {
      pool.healthCheck();

      if (config.audit) {
        const stats = pool.stats();
        console.log('[Pool] Stats:', {
          size: pool.size,
          connections: stats,
        });
      }

      return output;
    });
  },
};
