import type { Process } from '../../types.ts';

export function spawn(permissions?: Deno.PermissionOptions): Process {
  const url = new URL('../../worker.ts', import.meta.url).href;
  const perms = permissions || 'none';
  
  console.log(perms, "perms")
  const options = {
    type: 'module',
    deno: {
      namespace: true,
      permissions: perms,
    },
  } as WorkerOptions;

  const worker = new Worker(url, options);

  const kill = () => worker.terminate();

  return { worker, kill };
}
