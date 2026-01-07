const DEFAULT: Deno.PermissionOptions = "none";

export function normalize(permission?: Deno.PermissionOptions): Deno.PermissionOptions {
  if (!permission) return DEFAULT;
  
  if (permission === "inherit") {
    console.warn('[Permission] inherit rejected, using none');
    return DEFAULT;
  }
  
  return permission;
}
