import type { Process } from '../../types.ts';

export function spawn(permissions?: Deno.PermissionOptions): Process {
  const url = new URL('../../worker.ts', import.meta.url).href;
  const perms = permissions || "none";
  const options = { 
    type: 'module', 
    deno: { permissions: perms }
  } as WorkerOptions;
  const worker = new Worker(url, options);

  const kill = () => {
    try {
      worker.terminate();
    } catch {
      // ignore
    }
  };

  return { worker, kill };
}
