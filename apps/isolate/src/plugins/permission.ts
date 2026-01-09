import type { IsolatePlugin, Context, Toolset } from '../types.ts';
import { type APIHook, createAPIHook } from '@opencode/plugable';
import { merge, validate, normalize, resolve } from '../permissions/index.ts';
import { create } from '../common/builder.ts';

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
      
      if (toolset && ctx.context) {
        const registry = toolset.registry();
        const { names, configs } = ctx.context;
        
        for (const name of names) {
          const item = configs.has(name) 
            ? (create(name, configs.get(name)) ?? registry[name])
            : registry[name];
          
          if (!item?.permissions) continue;
          
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
      
      const whitelist = ctx.config.envWhitelist || ['PUBLIC_*'];
      const envList = typeof permissions === 'object' && permissions !== null 
        ? permissions.env 
        : undefined;
      const allowed = Array.isArray(envList)
        ? [...whitelist, ...envList]
        : whitelist;
      
      const variables = resolve(permissions, allowed);
      
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
