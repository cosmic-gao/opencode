import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type { Tool } from '../types.ts';
import { inject, lazy } from '../common.ts';

type Schema = Record<string, AnyPgTable>;
type Instance<T extends Schema> = PostgresJsDatabase<T>;

const DIRECTORY = '../schemas/';
const EXTENSION = '.ts';
const EXCLUDED = 'index.ts';

function validate(entry: Deno.DirEntry): boolean {
  return entry.isFile &&
    entry.name.endsWith(EXTENSION) &&
    entry.name !== EXCLUDED;
}

async function load(filename: string): Promise<Schema> {
  const module = await import(`${DIRECTORY}${filename}`);
  return module as Schema;
}

export async function scan(): Promise<Schema> {
  const location = new URL(DIRECTORY, import.meta.url);
  const schemas: Schema = {};

  try {
    for await (const entry of Deno.readDir(location)) {
      if (validate(entry)) {
        const module = await load(entry.name);
        Object.assign(schemas, module);
      }
    }
  } catch (error) {
    console.warn('Schema loading failed:', error);
  }

  return schemas;
}

function proxy<T extends Schema>(
  target: Database<T>,
  schemas: T,
): Database<T> & T {
  return new Proxy(target, {
    get: (obj, property: string | symbol) => {
      if (typeof property === 'symbol' || property in obj) {
        return Reflect.get(obj, property);
      }
      return schemas[property as keyof T];
    },
  }) as unknown as Database<T> & T;
}

class Database<T extends Schema> {
  constructor(
    private instance: Instance<T>,
    private schemas: T,
  ) {}

  get db(): Instance<T> {
    return this.instance;
  }

  static async create(): Promise<Database<Schema> & Schema> {
    const schemas = await scan();
    const url = Deno.env.get('DATABASE_URL');

    if (!url) {
      throw new Error('DATABASE_URL not found');
    }

    const connection = postgres(url);
    const instance = drizzle(connection, { schema: schemas });
    const database = new Database(instance, schemas);

    return proxy(database, schemas);
  }
}

export const db: Tool = {
  name: 'database',
  permissions: {
    env: ["DATABASE_URL"],
    net: ["*"],
  },
  setup(globals: Record<string, unknown>): void {
    const api = lazy(() => Database.create());
    inject(globals, 'db', api);
  },
};

export default db;
