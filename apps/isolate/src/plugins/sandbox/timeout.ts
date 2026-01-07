import type { Output } from '../../types.ts';

export function timeout(limit: number, start: number): {
  abort: AbortController;
  promise: Promise<Output>;
  clear: () => void;
} {
  const abort = new AbortController();
  let tid: number | undefined;

  const promise = new Promise<Output>((resolve) => {
    tid = setTimeout(() => {
      abort.abort();
      resolve({
        ok: false,
        logs: [{
          level: 'exception',
          message: 'Execution timeout',
          name: 'TimeoutError',
          timestamp: Date.now(),
        }],
        duration: Math.round(performance.now() - start),
      });
    }, limit);
  });

  const clear = () => {
    if (tid !== undefined) {
      clearTimeout(tid);
    }
  };

  return { abort, promise, clear };
}
