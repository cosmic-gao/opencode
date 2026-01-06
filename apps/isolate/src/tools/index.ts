import type { Tool } from '../types.ts'
import crypto from './crypto.ts'
import { channel } from './channel.ts'

export const tools: Tool[] = [
  crypto,
  channel,
]
