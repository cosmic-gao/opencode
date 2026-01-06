import type { IsolatePlugin, ChannelMessage, Process } from '../types.ts';

export const ChannelPlugin: IsolatePlugin = {
  name: 'opencode:channel',
  pre: [],
  post: [],
  required: ['opencode:sandbox'],
  usePlugins: [],
  registryHook: {},

  setup(api) {
    const clients = new Set<Worker>();

    api.onSpawn.tap((proc: Process) => {
      const worker = proc.worker;
      clients.add(worker);

      const handler = (event: MessageEvent) => {
        const msg = event.data as Partial<ChannelMessage>;

        if (msg && msg.type === 'channel' && msg.topic) {
          for (const client of clients) {
            if (client !== worker) {
              client.postMessage(msg);
            }
          }
        }
      };

      worker.addEventListener('message', handler);

      const originalKill = proc.kill;
      proc.kill = () => {
        clients.delete(worker);
        worker.removeEventListener('message', handler);
        originalKill.call(proc);
      };
    });
  },
};
