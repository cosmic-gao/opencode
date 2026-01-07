export function resolve(permissions: Deno.PermissionOptions): Record<string, unknown> {
  const variables: Record<string, unknown> = {};

  if (permissions === "none" || typeof permissions !== "object") {
    return variables;
  }

  const environment = permissions.env;
  
  if (environment === true) {
    for (const [key, value] of Object.entries(Deno.env.toObject())) {
      variables[key] = value;
    }
    return variables;
  }
  
  if (!Array.isArray(environment)) {
    return variables;
  }

  for (const key of environment) {
    const value = Deno.env.get(key);
    if (value !== undefined) {
      variables[key] = value;
    }
  }

  return variables;
}
