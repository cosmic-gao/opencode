import { bootstrap, reset } from './common.ts';
import type { Tool, Packet } from './types.ts';

// --IMPORTS--

const scope = globalThis as Record<string, unknown>;
const tools: Tool[] = [];

// --COLLECT--

self.onmessage = async (event: MessageEvent<Packet>): Promise<void> => {
  const { code, input, entry, url, globals, tools: names } = event.data;

  try {
    reset(scope, names);
    bootstrap(scope, tools, names, {
      ...globals,
      input,
    });

    const module = await import(url);
    const result = await module[entry](input);

    self.postMessage({ ok: true, result });
  } catch (error) {
    const serializableError = { name: error.name, message: error.message, stack: error.stack };
    self.postMessage({ ok: false, error: serializableError });
  } finally {
    reset(scope, names);
  }
};
