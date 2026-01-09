import postgres from 'postgres';
import type { Perms, Tool, DatabaseToolConfig } from '../../types.ts';
import { inject } from '../../common/index.ts';
import { Store } from './store.ts';
import { Auditor } from './auditor.ts';

export interface Config {
  hosts?: string[];
  audit?: DatabaseToolConfig;
}

export function database(config?: Config): Tool {
  let store: (Store & Record<string, unknown>) | null = null;
  let auditor: Auditor | undefined;

  return {
    name: 'database',
    permissions: (): Perms => {
      const extra = config?.hosts || [];
      const hosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  
      return {
        env: true, // allow postgres.js to read all PG* related envs without enumerating
        net: [...hosts, ...extra],
        read: true,
      };
    },
    config,
    setup: async (scope: Record<string, unknown>): Promise<void> => {
      const url = scope.DATABASE_URL as string | undefined;
      if (!url) {
        throw new Error('DATABASE_URL required');
      }

      // Initialize auditor if enabled
      if (config?.audit?.enableAudit) {
        auditor = new Auditor({
          enabled: true,
          console: config.audit.logToConsole,
        });
      }

      const client = postgres(url, {
        max: 10,
        idle_timeout: 120,
      });

      store = await Store.create(client, auditor);
      
      inject(scope, 'database', store);
    },
    teardown: async (): Promise<void> => {
      if (store) {
        await store.close();
        store = null;
      }
      auditor = undefined;
    },
  };
}
