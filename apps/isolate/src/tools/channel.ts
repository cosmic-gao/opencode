import { inject } from '../common/index.ts';
import type { Tool } from '../types.ts';

const STATE = '__channel_state__';
const LISTENER = '__channel_listener__';
const LIMIT = 50;
const QUEUE = 100;

interface State {
  listeners: Map<string, Set<(data: unknown) => void>>;
  queue: Array<{ topic: string; data: unknown }>;
  busy: boolean;
}

function state(scope: Record<string, unknown>): State {
  const current = scope[STATE] as State;
  if (!current) {
    throw new Error('Channel not initialized');
  }
  return current;
}

function push(scope: Record<string, unknown>, topic: string, data: unknown): void {
  const s = state(scope);
  if (s.queue.length < QUEUE) {
    s.queue.push({ topic, data });
    queueMicrotask(() => flush(scope));
  }
}

function flush(scope: Record<string, unknown>): void {
  const s = state(scope);
  if (s.busy || s.queue.length === 0) return;
  s.busy = true;

  while (s.queue.length > 0) {
    const msg = s.queue.shift();
    if (!msg) break;

    const handlers = s.listeners.get(msg.topic);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          handler(msg.data);
        } catch (e) {
          console.error(`Channel error [${msg.topic}]:`, e);
        }
      }
    }
  }

  s.busy = false;
}

export const channel: Tool = {
  name: 'channel',
  permissions: "none",
  setup: (scope) => {
    const s: State = {
      listeners: new Map(),
      queue: [],
      busy: false,
    };
    scope[STATE] = s;

    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (data && typeof data === 'object' && 'type' in data && data.type === 'channel') {
        push(scope, data.topic, data.data);
      }
    };
    
    self.addEventListener('message', listener);
    scope[LISTENER] = listener;

    const api = {
      emit: (topic: string, data: unknown) => {
        self.postMessage({ type: 'channel', topic, data });
      },
      on: (topic: string, handler: (data: unknown) => void) => {
        const current = state(scope);
        
        if (current.listeners.size > LIMIT) {
          throw new Error('Too many listeners');
        }
        
        if (!current.listeners.has(topic)) {
          current.listeners.set(topic, new Set());
        }
        current.listeners.get(topic)!.add(handler);
        
        queueMicrotask(() => flush(scope));
      },
      off: (topic: string, handler: (data: unknown) => void) => {
        const current = state(scope);
        const set = current.listeners.get(topic);
        if (set) {
          set.delete(handler);
        }
      },
    };

    Object.freeze(api);
    inject(scope, 'channel', api);
  },
  
  teardown: (scope) => {
    const listener = scope[LISTENER] as ((event: MessageEvent) => void) | undefined;
    if (listener) {
      self.removeEventListener('message', listener);
      delete scope[LISTENER];
    }
    
    const s = scope[STATE] as State | undefined;
    if (s) {
      s.listeners.clear();
      s.queue.length = 0;
      delete scope[STATE];
    }
  },
};

export default channel;