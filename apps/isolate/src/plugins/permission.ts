import type { IsolatePlugin, Context, Toolset } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import { merge, validate, normalize, resolve } from '../permissions/index.ts';

export const PermissionPlugin: IsolatePlugin = {
  name: 'opencode:permission',
  pre: ['opencode:sandbox'],
  post: [],
  required: ['opencode:guard', 'opencode:tools'],
  usePlugins: [],
  registryHook: {
    onToolset: createAPIHook<Toolset>(),
  },

  setup(api) {
    const toolset = (api.onToolset as APIHook<Toolset> | undefined)?.use() ?? null;

    api.onLoad.tap((ctx: Context) => {
      const request = ctx.request.permissions;
      
      let tool: Deno.PermissionOptions = "none";
      
      if (toolset && Array.isArray(ctx.tools) && ctx.tools.length > 0) {
        const registry = toolset.registry();
        
        for (const name of ctx.tools) {
          const item = registry[name];
          if (!item || !item.permissions) continue;
          
          const permission = typeof item.permissions === "function"
            ? item.permissions(ctx)
            : item.permissions;
          
          tool = merge(tool, permission as Deno.PermissionOptions);
        }
      }
      
      let final: Deno.PermissionOptions;
      if (!request) {
        final = tool;
      } else {
        final = merge(request, tool);
      }
      
      validate(final, ctx.config.strict || false);
      
      const permissions = normalize(final);
      const variables = resolve(permissions);
      
      const updated: Context = {
        ...ctx,
        permissions,
        globals: { ...ctx.globals, ...variables },
      };

      api.setContext(updated);
      return updated;
    });
  },
};
