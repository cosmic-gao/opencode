import { detect } from './detector.ts';

export function validate(perms: Deno.PermissionOptions, strict: boolean): void {
  if (!strict) return;
  
  const info = detect(perms);
  
  if (info.wild) {
    console.warn('[Strict] Wildcard permission detected');
  }
  
  if (info.hosts > 10) {
    console.warn(`[Strict] Too many hosts: ${info.hosts}`);
  }
  
  if (info.local) {
    console.warn('[Strict] Local host access detected');
  }
}
