import type { Tool } from '../types.ts';
import { crypto, type CryptoConfig } from './crypto.ts';
import { channel } from './channel.ts';
import { type Config as DbConfig, database } from './database/index.ts';

type Builder = (config?: unknown) => Tool;

export const registry: Record<string, Builder> = {
  crypto: (config?: unknown) => crypto(config as CryptoConfig),
  channel: () => channel,
  database: (config?: unknown) => database(config as DbConfig),
};
