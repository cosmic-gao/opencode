import { hydrate } from './index.ts';

type Handler = (args: unknown) => unknown | Promise<unknown>;
type Resolver = (value: unknown) => void;
type Rejecter = (reason: Error) => void;

interface Call {
  resolve: Resolver;
  reject: Rejecter;
}

export class Host {
  private handlers = new Map<string, Handler>();

  register(method: string, handler: Handler): void {
    this.handlers.set(method, handler);
  }

  async handle(method: string, args: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`Unknown method: ${method}`);
    }
    return await handler(args);
  }

  listen(worker: Worker): void {
    worker.addEventListener('message', async (event) => {
      if (event.data?.type !== 'rpc') return;

      const { id, method, args } = event.data;

      try {
        const result = await this.handle(method, args);
        const rows = Array.isArray(result)
          ? result
          : result && typeof result === 'object' && 'rows' in result
          ? (result as { rows: unknown[] }).rows
          : [];
        const columns = result && typeof result === 'object' && 'columns' in result
          ? (result as { columns: readonly { name: string }[] }).columns
          : [];

        worker.postMessage({ type: 'rpc:reply', id, result: hydrate(rows, columns) });
      } catch (error) {
        const err = error as Error;
        worker.postMessage({
          type: 'rpc:error',
          id,
          error: err.message,
          name: err.name,
        });
      }
    });
  }
}

export class Client {
  private calls = new Map<string, Call>();

  constructor() {
    self.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'rpc:reply') {
        const { id, result } = event.data;

        const call = this.calls.get(id);
        if (call) {
          this.calls.delete(id);
          call.resolve(result);
        }
      }

      if (event.data?.type === 'rpc:error') {
        const { id, error, name } = event.data;
        const call = this.calls.get(id);
        if (call) {
          this.calls.delete(id);
          const err = new Error(error);
          err.name = name || 'RPCError';
          call.reject(err);
        }
      }
    });
  }

  call(method: string, args: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.calls.set(id, { resolve, reject });

      self.postMessage({ type: 'rpc', id, method, args });
    });
  }
}
