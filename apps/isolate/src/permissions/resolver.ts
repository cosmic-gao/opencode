import * as whitelist from './whitelist.ts';

export function resolve(
  permissions: Deno.PermissionOptions,
  patterns: string[] = ['PUBLIC_*'],
): Record<string, unknown> {
  const variables: Record<string, unknown> = {};

  if (permissions === "none" || typeof permissions !== "object") {
    return variables;
  }

  const environment = permissions.env;
  
  if (environment === true) {
    // Apply whitelist to all environment variables
    const all = Deno.env.toObject();
    return whitelist.filter(all, patterns);
  }
  
  if (!Array.isArray(environment)) {
    return variables;
  }

  // Apply whitelist to requested keys
  const allowed = whitelist.keys(environment, patterns);
  for (const key of allowed) {
    const value = Deno.env.get(key);
    if (value !== undefined) {
      variables[key] = value;
    }
  }

  return variables;
}
