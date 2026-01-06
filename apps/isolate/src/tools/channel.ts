import { inject } from '../common.ts';
import type { Tool } from '../types.ts';

const listeners = new Map<string, Set<(data: unknown) => void>>();
const pending: Array<{ topic: string; data: unknown }> = [];
let isListening = false;

function dispatch(topic: string, data: unknown) {
  const handlers = listeners.get(topic);
  if (handlers && handlers.size > 0) {
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in channel handler for topic "${topic}":`, e);
      }
    }
    return true;
  }
  return false;
}

export const channel: Tool = {
  name: 'channel',
  setup: (globals) => {
    listeners.clear();
    pending.length = 0;

    if (!isListening) {
      self.addEventListener('message', (event: MessageEvent) => {
        const data = event.data;
        if (data && typeof data === 'object' && 'type' in data && data.type === 'channel') {
          const handled = dispatch(data.topic, data.data);
          if (!handled) {
            if (pending.length < 100) {
              pending.push({ topic: data.topic, data: data.data });
            }
          }
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
        
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i].topic === topic) {
            const msg = pending.splice(i, 1)[0];
            try {
              handler(msg.data);
            } catch (e) {
              console.error(`Error processing buffered message for topic "${topic}":`, e);
            }
          }
        }
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
