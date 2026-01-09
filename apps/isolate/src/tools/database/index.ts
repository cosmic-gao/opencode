import type { Perms, Tool, DatabaseToolConfig } from '../../types.ts';
import { inject } from '../../common/index.ts';
import { Proxy } from './proxy.ts';
import { Store } from './store.ts';

export interface Config {
  hosts?: string[];
  audit?: DatabaseToolConfig;
}

export function database(config?: Config): Tool {
  let store: Store | null = null;

  return {
    name: 'database',
    permissions: (): Perms => {
      const extra = config?.hosts || [];
      const hosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  
      return {
        env: ['DATABASE_URL'],
        net: [...hosts, ...extra],
      };
    },
    config,
    setup: (scope: Record<string, unknown>): void => {
      const url = scope.DATABASE_URL as string | undefined;
      if (!url) {
        throw new Error('DATABASE_URL required');
      }

      const proxy = new Proxy();
      store = Store.create(url, proxy);
      
      inject(scope, 'database', store);
    },
    teardown: async (): Promise<void> => {
      if (store) {
        await store.close();
        store = null;
      }
    },
  };
}
