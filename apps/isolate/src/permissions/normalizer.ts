const DEFAULT: Deno.PermissionOptions = "none";

export function normalize(permission?: Deno.PermissionOptions): Deno.PermissionOptions {
  if (!permission) return DEFAULT;
  
  if (typeof permission === "string") {
    return permission;
  }
  
  return permission;
}
