import { inject } from '../common.ts';
import type { Tool } from '../types.ts';

const listeners = new Map<string, Set<(data: unknown) => void>>();
const queue: Array<{ topic: string; data: unknown }> = [];
let isListening = false;
let processing = false;

function enqueue(topic: string, data: unknown): void {
  if (queue.length < 100) {
    queue.push({ topic, data });
    queueMicrotask(() => process());
  }
}

function process(): void {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const msg = queue.shift();
    if (!msg) break;

    const handlers = listeners.get(msg.topic);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          handler(msg.data);
        } catch (e) {
          console.error(`Error in channel handler for topic "${msg.topic}":`, e);
        }
      }
    }
  }

  processing = false;
}

export const channel: Tool = {
  name: 'channel',
  permissions: "none",
  setup: (globals) => {
    listeners.clear();
    queue.length = 0;
    processing = false;

    if (!isListening) {
      self.addEventListener('message', (event: MessageEvent) => {
        const data = event.data;
        if (data && typeof data === 'object' && 'type' in data && data.type === 'channel') {
          enqueue(data.topic, data.data);
        }
      });
      isListening = true;
    }

    const api = {
      emit: (topic: string, data: unknown) => {
        self.postMessage({
          type: 'channel',
          topic,
          data,
        });
      },
      on: (topic: string, handler: (data: unknown) => void) => {
        if (!listeners.has(topic)) {
          listeners.set(topic, new Set());
        }
        listeners.get(topic)!.add(handler);
        
        queueMicrotask(() => process());
      },
      off: (topic: string, handler: (data: unknown) => void) => {
        const set = listeners.get(topic);
        if (set) {
          set.delete(handler);
        }
      },
    };

    Object.freeze(api);
    inject(globals, 'channel', api);
  },
};

export default channel;