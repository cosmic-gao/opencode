import type { Process } from '../../types.ts';

export function spawn(permissions?: Deno.PermissionOptions): Process {
  const url = new URL('../../worker.ts', import.meta.url).href;
  const perms = permissions || 'none';
  
  const options = {
    type: 'module',
    deno: {
      namespace: true,
      permissions: perms,
    },
  } as WorkerOptions;

  console.log(options,"options")
  const worker = new Worker(url, options);

  const kill = () => worker.terminate();

  return { worker, kill };
}
