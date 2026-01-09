import type { IsolatePlugin } from '../types.ts';
import { Pool } from '../pool.ts';
import { Host } from '../common/rpc.ts';

export const DatabasePlugin: IsolatePlugin = {
  name: 'opencode:database',
  pre: [],
  post: [],
  required: [],

  setup(api) {
    const { config } = api.context();

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

    pool.init();

    const host = new Host();

    host.register('pool:get', (args) => {
      const { url } = args as { url: string };
      pool.get(url);
      return { connected: true };
    });

    host.register('pool:query', async (args) => {
      const { url, sql, params } = args as { url: string; sql: string; params?: unknown[] };
      const client = pool.get(url);
      
      try {
        const result = await client.unsafe(sql, params as never[]);
        return result;
      } finally {
        pool.release(url);
      }
    });

    host.register('pool:release', (args) => {
      const { url } = args as { url: string };
      pool.release(url);
      return { released: true };
    });

    host.register('pool:stats', () => {
      return pool.stats();
    });

    api.onSpawn.tap((process) => {
      host.listen(process.worker);
      return process;
    });

    api.onFormat.tap((output) => {
      if (config.audit) {
        const stats = pool.stats();
        console.log('[Pool]', {
          size: pool.size,
          connections: Object.keys(stats).length,
        });
      }

      return output;
    });
  },
};
