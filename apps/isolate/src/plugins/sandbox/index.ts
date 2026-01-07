import type { IsolatePlugin, Factory } from '../../types.ts';
import type { APIHook } from '@opencode/plugable';
import { createAPIHook } from '@opencode/plugable';
import { spawn } from './spawn.ts';
import { executor } from './executor.ts';

const factory: Factory = {
  spawn,
  runner: executor,
};

export const SandboxPlugin: IsolatePlugin = {
  name: 'opencode:sandbox',
  pre: ['opencode:loader'],
  post: [],
  required: ['opencode:guard', 'opencode:loader'],
  usePlugins: [],
  registryHook: {
    onWorker: createAPIHook<Factory>(),
  },

  setup(api) {
    if (!api.onWorker) {
      throw new Error('onWorker not registered');
    }

    const hookedFactory: Factory = {
      spawn: async (permissions?: Deno.PermissionOptions) => {
        const proc = await factory.spawn(permissions);
        api.onSpawn.call(proc);
        return proc;
      },
      runner: factory.runner,
    };

    (api.onWorker as APIHook<Factory>).provide(hookedFactory);

    api.onExecute.tap(async (ctx) => {
      if (ctx.output) return ctx
      
      const { request, url, config } = ctx;
      const limit = request.timeout ?? config.timeout;
      
      const w = await hookedFactory.spawn(ctx.permissions);
      const task = hookedFactory.runner(w, limit);
      
      const out = await task.run(request, url, ctx.globals, ctx.context);
      
      api.setContext({ output: out });
      return { ...ctx, output: out };
    });
  },
};
