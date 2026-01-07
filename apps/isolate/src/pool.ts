import postgres from 'postgres';

interface Entry {
  client: postgres.Sql;
  refs: number;
  used: number;
}

interface Config {
  limit?: number;
  options?: postgres.Options<Record<string, never>>;
}

const defaults: postgres.Options<Record<string, never>> = {
  max: 10,
  idle_timeout: 120,
  connect_timeout: 10,
  max_lifetime: 3600,
};

function mask(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function oldest(entries: Map<string, Entry>): string | null {
  let target: string | null = null;
  let time = Infinity;

  for (const [url, entry] of entries) {
    if (entry.refs === 0 && entry.used < time) {
      target = url;
      time = entry.used;
    }
  }

  return target;
}

export class Pool {
  private entries = new Map<string, Entry>();
  private limit: number;
  private options: postgres.Options<Record<string, never>>;

  constructor(config: Config = {}) {
    this.limit = config.limit || 50;
    this.options = config.options || defaults;
  }

  get(url: string): postgres.Sql {
    if (!url) {
      throw new Error('URL required');
    }

    let entry = this.entries.get(url);

    if (!entry) {
      if (this.entries.size >= this.limit) {
        this.evict();
      }

      const client = postgres(url, this.options);
      entry = { client, refs: 0, used: Date.now() };
      this.entries.set(url, entry);
    }

    entry.refs++;
    entry.used = Date.now();

    return entry.client;
  }

  release(url: string): void {
    const entry = this.entries.get(url);
    if (!entry) return;

    entry.refs = Math.max(0, entry.refs - 1);
    entry.used = Date.now();
  }

  private evict(): void {
    const target = oldest(this.entries);
    
    if (target) {
      this.close(target);
    } else {
      console.warn('Pool: All entries busy');
    }
  }

  private async close(url: string): Promise<void> {
    const entry = this.entries.get(url);
    if (!entry) return;

    try {
      await entry.client.end();
    } catch (error) {
      console.error(`Close failed for ${mask(url)}:`, error);
    }

    this.entries.delete(url);
  }

  stats() {
    const result: Record<string, { refs: number; used: number }> = {};
    
    for (const [url, entry] of this.entries) {
      result[mask(url)] = {
        refs: entry.refs,
        used: entry.used,
      };
    }

    return result;
  }

  async dispose(): Promise<void> {
    const tasks: Promise<void>[] = [];

    for (const [url, entry] of this.entries) {
      tasks.push(
        entry.client.end().catch((error) => {
          console.error(`Dispose failed for ${mask(url)}:`, error);
        })
      );
    }

    await Promise.all(tasks);
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

const pool = new Pool();
export { pool };
export default pool;
