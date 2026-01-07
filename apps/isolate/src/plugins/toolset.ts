import type { Context, IsolatePlugin, Toolset } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import type { DatabasePoolAPI } from './database.ts';
import { build } from '../tools/index.ts';
import { index, setup } from '../common/index.ts';

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

    // Try to get database pool API if available
    let poolAPI: DatabasePoolAPI | undefined;
    try {
      if (api.onDatabasePool) {
        poolAPI = (api.onDatabasePool as APIHook<DatabasePoolAPI>).use();
      }
    } catch {
      // Database pool not available, that's OK
      console.log('[ToolsetPlugin] Database pool not available, db tool will not function');
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
