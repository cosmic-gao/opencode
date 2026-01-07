import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type { Perms, Tool, InternalAPI } from '../types.ts';
import { inject } from '../common/index.ts';
import type { PoolAPI } from '../pool.ts';

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
    console.error('Schema scan error:', {
      error,
      location: location.href,
      pathname: location.pathname,
      dir: DIR,
      metaUrl: import.meta.url,
    });
  }

  return schemas;
}

class Query<T extends AnyPgTable> {
  constructor(
    private client: PostgresJsDatabase<Record<string, never>>,
    private table: T,
  ) {}

  select() {
    return this.client.select().from(this.table as AnyPgTable);
  }

  insert(values: unknown) {
    return this.client.insert(this.table as AnyPgTable).values(values as never);
  }

  update(values: unknown) {
    return this.client.update(this.table as AnyPgTable).set(values as never);
  }

  delete() {
    return this.client.delete(this.table as AnyPgTable);
  }
}

function wrapTables<T extends Schema>(
  client: Client<T>,
  schemas: T,
): Record<string, Query<AnyPgTable>> {
  const wrapped: Record<string, Query<AnyPgTable>> = {};

  for (const [name, table] of Object.entries(schemas)) {
    wrapped[name] = new Query(
      client as unknown as PostgresJsDatabase<Record<string, never>>,
      table,
    );
  }

  return wrapped;
}

function extend<T extends Schema>(
  target: Store<T>,
  tables: Record<string, Query<AnyPgTable>>,
): Store<T> & Record<string, Query<AnyPgTable>> {
  return new Proxy(target, {
    get: (obj, prop: string | symbol) => {
      if (typeof prop === 'symbol' || prop in obj) {
        return Reflect.get(obj, prop);
      }
      return tables[prop as string];
    },
  }) as unknown as Store<T> & Record<string, Query<AnyPgTable>>;
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

  static async create(
    url: string,
    pool: PoolAPI,
  ): Promise<Store<Schema> & Record<string, Query<AnyPgTable>>> {
    const schemas = await scan();

    if (!url) {
      throw new Error('DATABASE_URL required');
    }

    const client = pool.get(url);
    const instance = drizzle(client, { schema: schemas });
    const store = new Store(instance, schemas, url, pool);
    const tables = wrapTables(instance, schemas);

    return extend(store, tables);
  }
}

export function db(config?: Config): Tool {
  let instance: (Store<Schema> & Record<string, Query<AnyPgTable>>) | null = null;

  return {
    name: 'db',
    permissions: (): Perms => {
      const extra = config?.hosts || [];
      const hosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  
      return {
        env: true,
        net: [...hosts, ...extra],
        read: true,
      };
    },
    config,
    setup: async (scope: Record<string, unknown>, internal?: InternalAPI): Promise<void> => {
      const pool = internal?.pool;
      if (!pool) {
        throw new Error('PoolAPI not available. Ensure PoolPlugin is registered.');
      }

      const url = scope.DATABASE_URL as string | undefined;
      if (!url) {
        throw new Error('DATABASE_URL environment variable is required');
      }

      instance = await Store.create(url, pool as PoolAPI);
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
