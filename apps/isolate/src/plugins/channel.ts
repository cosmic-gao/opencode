import type { IsolatePlugin, ChannelMessage, Process } from '../types.ts';

const MAX_MESSAGE_SIZE = 100000;
const RATE_LIMIT_WINDOW = 1000;
const RATE_LIMIT_MAX = 100;

export const ChannelPlugin: IsolatePlugin = {
  name: 'opencode:channel',
  pre: [],
  post: [],
  required: ['opencode:sandbox'],
  usePlugins: [],
  registryHook: {},

  setup(api) {
    const clients = new Set<Worker>();
    const rates = new WeakMap<Worker, { count: number; window: number }>();

    api.onSpawn.tap((proc: Process) => {
      const worker = proc.worker;
      clients.add(worker);

      const handler = (event: MessageEvent) => {
        const msg = event.data as Partial<ChannelMessage>;

        if (msg && msg.type === 'channel' && msg.topic) {
          const size = JSON.stringify(msg.data ?? null).length;
          if (size > MAX_MESSAGE_SIZE) {
            return;
          }

          const now = Date.now();
          let rate = rates.get(worker);
          
          if (!rate || now - rate.window > RATE_LIMIT_WINDOW) {
            rate = { count: 0, window: now };
            rates.set(worker, rate);
          }
          
          rate.count++;
          if (rate.count > RATE_LIMIT_MAX) {
            return;
          }

          for (const client of clients) {
            if (client !== worker) {
              client.postMessage(msg);
            }
          }
        }
      };

      const cleanup = () => {
        clients.delete(worker);
        worker.removeEventListener('message', handler);
      };

      worker.addEventListener('message', handler);
      worker.addEventListener('error', cleanup, { once: true });
      worker.addEventListener('messageerror', cleanup, { once: true });

      const originalKill = proc.kill;
      proc.kill = () => {
        cleanup();
        originalKill.call(proc);
      };
    });
  },
};
