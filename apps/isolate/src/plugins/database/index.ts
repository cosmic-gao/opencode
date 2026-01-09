import type { IsolatePlugin } from '../../types.ts';
import { Pool } from './pool.ts';
import { Host } from '../../common/rpc.ts';
import type postgres from 'postgres';

interface TransactionMethods {
  unsafe: (sql: string, params?: unknown[]) => Promise<unknown>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

interface TransactionEntry {
  tx: postgres.TransactionSql<Record<string, never>> & TransactionMethods;
  url: string;
}

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
    const transactions = new Map<string, TransactionEntry>();

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

    host.register('pool:begin', async (args) => {
      const { url, options } = args as { url: string; options?: unknown };
      const client = pool.get(url);
      const txId = crypto.randomUUID();
      const tx = (await client.begin(options as never)) as TransactionEntry['tx'];
      transactions.set(txId, { tx, url });
      
      setTimeout(() => {
        if (transactions.has(txId)) {
          const entry = transactions.get(txId);
          if (entry) {
            entry.tx.rollback().catch(() => {});
            transactions.delete(txId);
            pool.release(entry.url);
          }
        }
      }, 30000);
      
      return txId;
    });

    host.register('pool:txQuery', async (args) => {
      const { txId, sql, params } = args as { txId: string; sql: string; params?: unknown[] };
      const entry = transactions.get(txId);
      if (!entry) throw new Error(`Transaction ${txId} not found`);
      return await entry.tx.unsafe(sql, params as never[]);
    });

    host.register('pool:txCommit', async (args) => {
      const { txId } = args as { txId: string };
      const entry = transactions.get(txId);
      if (!entry) throw new Error(`Transaction ${txId} not found`);
      await entry.tx.commit();
      transactions.delete(txId);
      pool.release(entry.url);
    });

    host.register('pool:txRollback', async (args) => {
      const { txId } = args as { txId: string };
      const entry = transactions.get(txId);
      if (entry) {
        await entry.tx.rollback();
        transactions.delete(txId);
        pool.release(entry.url);
      }
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
