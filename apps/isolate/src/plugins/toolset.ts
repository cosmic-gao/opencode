import type { Context, IsolatePlugin, Toolset } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import { build } from '../tools/index.ts';
import { index, setup, extract } from '../common/index.ts';

export const ToolsetPlugin: IsolatePlugin = {
  name: 'opencode:tools',
  pre: ['opencode:guard'],
  post: ['opencode:loader', 'opencode:database'],
  required: ['opencode:guard'],
  usePlugins: [],
  registryHook: {
    onToolset: createAPIHook<Toolset>(),
  },

  setup(api) {
    if (!api.onToolset) {
      throw new Error('onToolset not registered');
    }
    
    const { config } = api.context();

    const tools = build(config);
    const defaults = index(tools);

    const factory: Toolset = {
      tools: () => tools,
      registry: () => defaults,
      setup,
    };

    (api.onToolset as APIHook<Toolset>).provide(factory);

    api.onLoad.tap((ctx: Context) => {
      const specs = ctx.request.tools ?? [];
      const registry = factory.registry();
      const { names, configs } = extract(specs, registry);

      const updated: Context = {
        ...ctx,
        context: { names, configs },
      };

      api.setContext(updated);
      return updated;
    });
  },
};
