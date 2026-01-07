export function merge(
  base: Deno.PermissionOptions,
  extra: Deno.PermissionOptions,
): Deno.PermissionOptions {
  if (base === "inherit" || extra === "inherit") {
    throw new Error('Inherit forbidden');
  }
  
  if (base === "none") return extra;
  if (extra === "none") return base;
  
  const baseobject = base as Record<string, unknown>;
  const extraobject = extra as Record<string, unknown>;
  const result: Record<string, unknown> = { ...baseobject };
  
  for (const [key, value] of Object.entries(extraobject)) {
    if (key in result) {
      if (Array.isArray(result[key]) && Array.isArray(value)) {
        const set = new Set(result[key] as string[]);
        const arr = value as string[];
        result[key] = Array.from(new Set([...set, ...arr]));
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  
  return result as Deno.PermissionOptions;
}
