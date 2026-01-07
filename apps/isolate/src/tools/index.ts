import type { Tool, Config } from '../types.ts';
import { crypto } from './crypto.ts';
import { channel } from './channel.ts';
import { db } from './db.ts';

export function build(config?: Config): Tool[] {
  return [
    crypto(config?.crypto),
    channel,
    db(),
  ];
}
