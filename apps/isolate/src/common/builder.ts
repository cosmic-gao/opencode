import type { Tool } from '../types.ts';
import { crypto, type CryptoConfig } from '../tools/crypto.ts';
import { channel } from '../tools/channel.ts';
import { db, type Config as DbConfig } from '../tools/db.ts';

type Builder = (config?: unknown) => Tool;

const registry: Record<string, Builder> = {
  crypto: (config?: unknown) => crypto(config as CryptoConfig),
  channel: () => channel,
  db: (config?: unknown) => db(config as DbConfig),
};

export function build(name: string, config?: unknown): Tool | undefined {
  const builder = registry[name];
  return builder?.(config);
}

export function resolve(
  names: string[],
  defaults: Record<string, Tool>,
  configs?: Map<string, unknown>
): Tool[] {
  if (!configs || configs.size === 0) {
    return names.map(name => defaults[name]).filter(Boolean);
  }

  return names.map(name => {
    if (configs.has(name)) {
      return build(name, configs.get(name)) ?? defaults[name];
    }
    return defaults[name];
  }).filter(Boolean);
}
