import { drizzle, type PgRemoteDatabase, type RemoteCallback } from 'drizzle-orm/pg-proxy';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type { Auditor } from './auditor.ts';
import { Proxy } from './proxy.ts';

const DIR = '../../schemas/';
const EXT = '.ts';
const SKIP = 'index.ts';

type Schema = Record<string, AnyPgTable>;

function valid(entry: Deno.DirEntry): boolean {
  return entry.isFile && entry.name.endsWith(EXT) && entry.name !== SKIP;
}

async function load(name: string): Promise<Schema> {
  const module = await import(`${DIR}${name}`);
  return module as Schema;
}

async function scan(): Promise<Schema> {
  const location = new URL(DIR, import.meta.url);
  const schemas: Schema = {};

  try {
    let path = location.pathname;
    if (path.startsWith('/') && path[2] === ':') {
      path = path.slice(1);
    }

    for await (const entry of Deno.readDir(path)) {
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

export class Store {
  private dbInstance: PgRemoteDatabase<Schema> | null = null;
  private schemas: Schema = {};

  constructor(
    private url: string,
    private proxy: Proxy,
    private auditor?: Auditor,
  ) {}

  async init(): Promise<Store & Record<string, TableOperations>> {
    this.schemas = await scan();

    const executor: RemoteCallback = async (sql, params = [], _method) => {
      const rows = await this.proxy.query(this.url, sql, params);
      return {
        // deno-lint-ignore no-explicit-any
        rows: rows as any[],
      };
    };

    this.dbInstance = drizzle(executor, { schema: this.schemas });

    return new globalThis.Proxy(this as unknown as Store & Record<string, TableOperations>, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'symbol' || prop in target) {
          return Reflect.get(target, prop);
        }

        const table = this.schemas[prop];
        if (!table) {
          return undefined;
        }

        return {
          select:  () => {
            this.auditor?.record('select', prop);
            return this.dbInstance!.select().from(table);
          },
          insert: (values: unknown) => {
            this.auditor?.record('insert', prop);
            return this.dbInstance!.insert(table).values(values as never);
          },
          update: (values: unknown) => {
            this.auditor?.record('update', prop);
            return {
              where: (condition: unknown) =>
                this.dbInstance!.update(table).set(values as never).where(condition as never),
            };
          },
          delete: () => {
            this.auditor?.record('delete', prop);
            return {
              where: (condition: unknown) =>
                this.dbInstance!.delete(table).where(condition as never),
            };
          },
        };
      },
    }) as Store & Record<string, TableOperations>;
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    return await this.proxy.query(this.url, sql, params);
  }

  async close(): Promise<void> {
  }

  static async create(
    url: string,
    proxy: Proxy,
    auditor?: Auditor,
  ): Promise<Store & Record<string, TableOperations>> {
    const store = new Store(url, proxy, auditor);
    return await store.init();
  }
}

interface TableOperations {
  select: () => unknown;
  insert: (values: unknown) => unknown;
  update: (values: unknown) => { where: (condition: unknown) => unknown };
  delete: () => { where: (condition: unknown) => unknown };
}
