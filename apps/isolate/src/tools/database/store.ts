import { Proxy } from './proxy.ts';

export class Store {
  constructor(
    private url: string,
    private proxy: Proxy,
  ) {}

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    return await this.proxy.query(this.url, sql, params);
  }

  async close(): Promise<void> {
    await this.proxy.release(this.url);
  }

  static create(url: string, proxy: Proxy): Store {
    if (!url) {
      throw new Error('DATABASE_URL required');
    }

    return new Store(url, proxy);
  }
}
