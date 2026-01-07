import type { Process, Runner, Request, Output, Packet, ToolContext } from '../../types.ts';
import { send, wait } from '../../bridge.ts';
import { timeout } from './timeout.ts';

export function executor(proc: Process, limit: number): Runner {
  const run = async (
    request: Request,
    url: string,
    globals?: Record<string, unknown>,
    context?: ToolContext
  ): Promise<Output> => {
    const start = performance.now();
    const ctrl = timeout(limit, start);

    try {
      const result = wait(proc.worker, ctrl.abort.signal);

      const msg: Packet = {
        code: request.code,
        input: request.input as unknown,
        entry: request.entry ?? 'default',
        url,
        globals,
        context,
      };

      send(proc.worker, msg);

      const out = await Promise.race([result, ctrl.promise]);
      const duration = Math.round(performance.now() - start);

      if (!ctrl.abort.signal.aborted) {
        try {
          proc.kill();
        } catch {
          // ignore
        }
      }

      return {
        ...out,
        duration,
      };
    } finally {
      ctrl.clear();
    }
  };

  return { run };
}
