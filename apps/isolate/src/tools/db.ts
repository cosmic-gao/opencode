import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as operators from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type { Tool } from '../types.ts';
import { inject } from '../common.ts';

type Schema = Record<string, AnyPgTable>;
type DatabaseInstance<T extends Schema> = PostgresJsDatabase<T>;

const SCHEMAS_DIRECTORY = '../schemas/';
const SCHEMA_FILE_EXTENSION = '.ts';
const INDEX_FILE = 'index.ts';

async function loadSchemas(): Promise<Schema> {
  const directory = new URL(SCHEMAS_DIRECTORY, import.meta.url);
  const schemas: Schema = {};

  try {
    for await (const entry of Deno.readDir(directory)) {
      if (
        !entry.isFile || !entry.name.endsWith(SCHEMA_FILE_EXTENSION) || entry.name === INDEX_FILE
      ) {
        continue;
      }

      const module = await import(`${SCHEMAS_DIRECTORY}${entry.name}`);
      Object.assign(schemas, module);
    }
  } catch (error) {
    console.warn('Failed to load schemas:', error);
  }

  return schemas;
}

class Database<T extends Schema> {
  private readonly instance: DatabaseInstance<T>;
  private readonly client: postgres.Sql;
  private readonly schemas: T;

  private constructor(connection: string, schemas: T) {
    this.schemas = schemas;
    this.client = postgres(connection);
    this.instance = drizzle(this.client, { schema: schemas });

    return this.proxy();
  }

  private proxy(): Database<T> & T {
    return new Proxy(this, {
      get: (target, property: string | symbol) => {
        if (typeof property === 'symbol' || property in target) {
          return Reflect.get(target, property);
        }

        if (property in this.schemas) {
          return this.schemas[property as keyof T];
        }

        return undefined;
      },
    }) as unknown as Database<T> & T;
  }

  static async create<T extends Schema>(connection: string): Promise<Database<T>> {
    const schemas = await loadSchemas() as T;
    return new Database(connection, schemas);
  }

  get query(): DatabaseInstance<T> {
    return this.instance;
  }

  get operators() {
    return operators;
  }

  get tables(): readonly string[] {
    return Object.keys(this.schemas);
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  async transaction<Result>(
    callback: (transaction: DatabaseInstance<T>) => Promise<Result>,
  ): Promise<Result> {
    return await this.instance.transaction(callback);
  }
}

export const db: Tool = {
  name: 'db',
  setup: async (globals: Record<string, unknown>): Promise<void> => {
    const connection = Deno.env.get('DATABASE_URL');
    if (!connection) return;

    if (globals.db) return;

    const instance = await Database.create(connection);
    Object.freeze(instance);
    inject(globals, 'db', instance);
  },
};

export default db;
