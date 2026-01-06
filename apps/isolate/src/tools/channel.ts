import { inject } from '../common.ts';
import type { Tool } from '../types.ts';

const listeners = new Map<string, Set<(data: unknown) => void>>();
let isListening = false;

function dispatch(topic: string, data: unknown) {
  const handlers = listeners.get(topic);
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in channel handler for topic "${topic}":`, e);
      }
    }
  }
}

export const channel: Tool = {
  name: 'channel',
  setup: (globals) => {
    listeners.clear();

    if (!isListening) {
      self.addEventListener('message', (event: MessageEvent) => {
        const data = event.data;
        if (data && typeof data === 'object' && 'type' in data && data.type === 'channel') {
          dispatch(data.topic, data.data);
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
