import { Client } from '../../common/rpc.ts';

export class Proxy {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  async query(url: string, sql: string, params?: unknown[]): Promise<unknown> {
    return await this.client.call('pool:query', { url, sql, params });
  }

  async release(url: string): Promise<void> {
    await this.client.call('pool:release', { url });
  }

  async stats(): Promise<Record<string, unknown>> {
    return await this.client.call('pool:stats', {}) as Record<string, unknown>;
  }
}
