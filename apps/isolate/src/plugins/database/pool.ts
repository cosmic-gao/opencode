import postgres from 'postgres';

interface Entry {
  client: postgres.Sql;
  refs: number;
  used: number;
  health: 'ok' | 'suspected' | 'dead';
}

interface Config {
  limit?: number;
  options?: postgres.Options<Record<string, never>>;
  cleanupInterval?: number;
  idleTimeout?: number;
}

const DEFAULT_OPTIONS: postgres.Options<Record<string, never>> = {
  max: 10,
  idle_timeout: 120,
  connect_timeout: 10,
  max_lifetime: 3600
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
  private cleanupTimer?: number;
  private cleanupInterval: number;
  private idleTimeout: number;

  constructor(config: Config = {}) {
    this.limit = config.limit || 50;
    this.options = config.options || DEFAULT_OPTIONS;
    this.cleanupInterval = config.cleanupInterval || 60_000; // 60s
    this.idleTimeout = config.idleTimeout || 120_000; // 120s
  }

  init(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  get(url: string): postgres.Sql {
    if (!url) {
      throw new Error('URL required');
    }

    let entry = this.entries.get(url);

    if (!entry || entry.health === 'dead') {
      if (entry?.health === 'dead') {
        this.close(url);
      }

      if (this.entries.size >= this.limit) {
        this.evict();
      }
     
      const client = postgres(url, this.options);
      entry = { client, refs: 0, used: Date.now(), health: 'ok' };
      this.entries.set(url, entry);
    }

    entry.refs++;
    entry.used = Date.now();
    entry.health = 'ok'; // Reset health on use

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
      console.warn('[Pool] All entries busy, cannot evict');
    }
  }

  private async close(url: string): Promise<void> {
    const entry = this.entries.get(url);
    if (!entry) return;

    try {
      await entry.client.end();
    } catch (error) {
      console.error(`[Pool] Close failed for ${mask(url)}:`, error);
    }

    this.entries.delete(url);
  }

  private cleanup(): void {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [url, entry] of this.entries) {
      if (entry.refs === 0 && now - entry.used > this.idleTimeout) {
        toClose.push(url);
      }
    }

    for (const url of toClose) {
      this.close(url);
    }

    if (toClose.length > 0) {
      console.log(`[Pool] Cleaned up ${toClose.length} idle connections`);
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    const tasks: Promise<void>[] = [];

    for (const [url, entry] of this.entries) {
      tasks.push(
        entry.client.end().catch((error) => {
          console.error(`[Pool] Dispose failed for ${mask(url)}:`, error);
        }),
      );
    }

    await Promise.all(tasks);
    this.entries.clear();
  }

  stats(): Record<string, { refs: number; used: number; health: string }> {
    const result: Record<string, { refs: number; used: number; health: string }> = {};

    for (const [url, entry] of this.entries) {
      result[mask(url)] = {
        refs: entry.refs,
        used: entry.used,
        health: entry.health,
      };
    }

    return result;
  }

  get size(): number {
    return this.entries.size;
  }

  health(): void {
    const now = Date.now();
    const suspectThreshold = 300_000; // 5 minutes

    for (const [_url, entry] of this.entries) {
      if (entry.refs === 0 && now - entry.used > suspectThreshold) {
        entry.health = 'suspected';
      }
    }
  }
}

export interface PoolAPI {
  get: (url: string) => postgres.Sql;
  release: (url: string) => void;
  stats: () => Record<string, { refs: number; used: number; health: string }>;
  size: () => number;
  health: () => void;
}
