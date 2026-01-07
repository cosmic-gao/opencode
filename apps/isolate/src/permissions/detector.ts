export interface Detection {
  wild: boolean;
  hosts: number;
  local: boolean;
}

export function detect(perms: Deno.PermissionOptions): Detection {
  if (typeof perms === 'string') {
    return { wild: false, hosts: 0, local: false };
  }
  
  const net = (perms as Record<string, unknown>).net as string[] | undefined;
  
  if (!Array.isArray(net)) {
    return { wild: false, hosts: 0, local: false };
  }
  
  const wild = net.includes('*');
  const hosts = net.length;
  const local = net.some(h => h.includes('127.0.0.1') || h.includes('localhost'));
  
  return { wild, hosts, local };
}
