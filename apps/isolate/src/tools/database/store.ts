import { Proxy } from './proxy.ts';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type postgres from 'postgres';
import type { Auditor } from './auditor.ts';

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

class Client {
  public types: Record<string | number, unknown>;
  public parsers: Record<string, unknown>;
  public options: Record<string, unknown>;

  constructor(private url: string, private proxy: Proxy) {
    this.types = {};
    this.parsers = {
      array: () => (value: unknown) => value,
      text: () => (value: unknown) => value,
      json: () => (value: unknown) => value,
      int: () => (value: unknown) => value,
      bigint: () => (value: unknown) => value,
    };
    this.options = {
      max: 10,
      idle_timeout: 120,
    };
  }

  async unsafe(sql: string, params?: unknown[]): Promise<unknown> {
    return await this.proxy.query(this.url, sql, params);
  }

  async begin(options?: unknown): Promise<Transaction> {
    const txId = await this.proxy.begin(this.url, options);
    return new Transaction(txId, this.proxy);
  }
}

class Transaction {
  public types: Record<string | number, unknown>;
  public parsers: Record<string, unknown>;

  constructor(private txId: string, private proxy: Proxy) {
    this.types = {};
    this.parsers = {
      array: () => (value: unknown) => value,
      text: () => (value: unknown) => value,
      json: () => (value: unknown) => value,
      int: () => (value: unknown) => value,
      bigint: () => (value: unknown) => value,
    };
  }

  async unsafe(sql: string, params?: unknown[]): Promise<unknown> {
    return await this.proxy.txQuery(this.txId, sql, params);
  }

  async commit(): Promise<void> {
    await this.proxy.txCommit(this.txId);
  }

  async rollback(): Promise<void> {
    await this.proxy.txRollback(this.txId);
  }
}

export class Store {
  private dbInstance: PostgresJsDatabase<Schema> | null = null;
  private schemas: Schema = {};
  
  constructor(
    private url: string,
    private proxy: Proxy,
    private auditor?: Auditor,
  ) {}

  async init(): Promise<Store & Record<string, TableOperations>> {
    this.schemas = await scan();
    const client = new Client(this.url, this.proxy) as unknown as postgres.Sql;
    this.dbInstance = drizzle(client, { schema: this.schemas });
    
    return new globalThis.Proxy(this, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'symbol' || prop in target) {
          return Reflect.get(target, prop);
        }
        
        const table = this.schemas[prop];
        if (!table) {
          return undefined;
        }
        
        return {
          select: (...args: unknown[]) => {
            this.auditor?.record('select', prop);
            return this.dbInstance!.select().from(table)(...(args as []));
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
    await this.proxy.release(this.url);
  }

  static async create(
    url: string, 
    proxy: Proxy, 
    auditor?: Auditor
  ): Promise<Store & Record<string, TableOperations>> {
    if (!url) {
      throw new Error('DATABASE_URL required');
    }

    const store = new Store(url, proxy, auditor);
    return await store.init();
  }
}

interface TableOperations {
  select: (...args: unknown[]) => unknown;
  insert: (values: unknown) => unknown;
  update: (values: unknown) => { where: (condition: unknown) => unknown };
  delete: () => { where: (condition: unknown) => unknown };
}
