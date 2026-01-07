import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type { Perms, Tool } from '../types.ts';
import { inject } from '../common/index.ts';
import { parse } from '../permissions/index.ts';

// Import PoolAPI type
import type { PoolAPI } from '../plugins/database.ts';

export interface Config {
  hosts?: string[];
}

type Schema = Record<string, AnyPgTable>;
type Client<T extends Schema> = PostgresJsDatabase<T>;

const DIR = '../schemas/';
const EXT = '.ts';
const SKIP = 'index.ts';

function valid(entry: Deno.DirEntry): boolean {
  return entry.isFile &&
    entry.name.endsWith(EXT) &&
    entry.name !== SKIP;
}

async function load(name: string): Promise<Schema> {
  const module = await import(`${DIR}${name}`);
  return module as Schema;
}

export async function scan(): Promise<Schema> {
  const location = new URL(DIR, import.meta.url);
  const schemas: Schema = {};

  try {
    for await (const entry of Deno.readDir(location)) {
      if (valid(entry)) {
        const module = await load(entry.name);
        Object.assign(schemas, module);
      }
    }
  } catch (error) {
    console.warn('Schema load failed:', error);
  }

  return schemas;
}

function extend<T extends Schema>(
  target: Store<T>,
  schemas: T,
): Store<T> & T {
  return new Proxy(target, {
    get: (obj, prop: string | symbol) => {
      if (typeof prop === 'symbol' || prop in obj) {
        return Reflect.get(obj, prop);
      }
      return schemas[prop as keyof T];
    },
  }) as unknown as Store<T> & T;
}

class Store<T extends Schema> {
  constructor(
    private client: Client<T>,
    private schemas: T,
    private url: string,
    private pool: PoolAPI,
  ) {}

  get db(): Client<T> {
    return this.client;
  }

  close(): void {
    this.pool.release(this.url);
  }

  static async create(url: string, pool: PoolAPI): Promise<Store<Schema> & Schema> {
    const schemas = await scan();

    if (!url) {
      throw new Error('DATABASE_URL required');
    }

    const client = pool.get(url);
    const instance = drizzle(client, { schema: schemas });
    const store = new Store(instance, schemas, url, pool);

    return extend(store, schemas);
  }
}

export function db(config?: Config, poolAPI?: PoolAPI): Tool {
  let instance: (Store<Schema> & Schema) | null = null;

  return {
    name: 'database',
    permissions: (): Perms => {
      const url = Deno.env.get('DATABASE_URL') || '';
      const host = parse(url);
      const extra = config?.hosts || [];
      return {
        env: ['DATABASE_URL'],
        net: [host, ...extra],
      };
    },
    config,
    setup: async (scope: Record<string, unknown>): Promise<void> => {
      if (!poolAPI) {
        throw new Error('PoolAPI not available. Ensure PoolPlugin is registered.');
      }

      const url = Deno.env.get('DATABASE_URL');
      if (!url) {
        throw new Error('DATABASE_URL environment variable is required');
      }

      instance = await Store.create(url, poolAPI);
      inject(scope, 'db', instance);
    },
    teardown: (): void => {
      if (instance) {
        instance.close();
        instance = null;
      }
    },
  };
}
