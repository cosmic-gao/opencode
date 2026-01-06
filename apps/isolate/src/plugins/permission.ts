import type { IsolatePlugin, Context } from '../types.ts';

const DEFAULT: Deno.PermissionOptions = "none";

function normalize(perms?: Deno.PermissionOptions): Deno.PermissionOptions {
  if (!perms) return DEFAULT;
  
  if (perms === "inherit") {
    console.warn('[Permission] inherit rejected, using none');
    return DEFAULT;
  }
  
  return perms;
}

export const PermissionPlugin: IsolatePlugin = {
  name: 'opencode:permission',
  pre: ['opencode:sandbox'],
  post: [],
  required: ['opencode:guard'],
  usePlugins: [],
  registryHook: {},

  setup(api) {
    api.onLoad.tap((ctx: Context) => {
      const permissions = normalize(ctx.request.permissions);
      
      const updated: Context = {
        ...ctx,
        permissions,
      };

      api.setContext(updated);
      return updated;
    });
  },
};
