import type { Context, IsolatePlugin, Toolset } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import { tools } from '../tools/index.ts';
import { registry, setup } from '../common.ts';

const defaults = registry(tools);

const factory: Toolset = {
  tools: () => tools,
  registry: () => defaults,
  setup,
};

export const ToolsetPlugin: IsolatePlugin = {
  name: 'opencode:tools',
  pre: ['opencode:guard'],
  post: ['opencode:loader'],
  required: ['opencode:guard'],
  usePlugins: [],
  registryHook: {
    onToolset: createAPIHook<Toolset>(),
  },

  setup(api) {
    if (!api.onToolset) {
      throw new Error('onToolset not registered');
    }

    (api.onToolset as APIHook<Toolset>).provide(factory);

    api.onLoad.tap((ctx: Context) => {
      const requested = ctx.request.tools ?? [];
      const registry = factory.registry();

      const valid: string[] = [];
      for (const name of requested) {
        if (name in registry) {
          valid.push(name);
        }
      }

      const updated: Context = {
        ...ctx,
        tools: valid,
      };

      api.setContext(updated);

      return updated;
    });
  },
};
