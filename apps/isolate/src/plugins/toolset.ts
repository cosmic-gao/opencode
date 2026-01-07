import type { Context, IsolatePlugin, Toolset } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import type { PoolAPI } from './database.ts';
import { build } from '../tools/index.ts';
import { index, setup } from '../common/index.ts';

export const ToolsetPlugin: IsolatePlugin = {
  name: 'opencode:tools',
  pre: ['opencode:guard'],
  post: ['opencode:loader', 'opencode:pool'],
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

    // Try to get pool API if available
    let poolAPI: PoolAPI | undefined;
    try {
      if (api.onPool) {
        poolAPI = (api.onPool as APIHook<PoolAPI>).use();
      }
    } catch {
      // Pool not available, that's OK
      console.log('[ToolsetPlugin] Pool not available, db tool will not function');
    }

    const tools = build(config, poolAPI);
    const defaults = index(tools);

    const factory: Toolset = {
      tools: () => tools,
      registry: () => defaults,
      setup,
    };

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
