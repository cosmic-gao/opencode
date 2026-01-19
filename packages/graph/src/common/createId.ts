import { nanoid } from 'nanoid'

/**
 * ID 生成选项
 */
export interface IdOptions {
  /** ID 前缀 */
  prefix?: string
  /** ID 长度（不包含前缀），默认为 16 */
  length?: number
}

/**
 * 生成唯一标识符
 *
 * @param options - 生成选项或前缀字符串
 * @returns 生成的 ID
 *
 * @example
 * createId() // => "V1StGXR8_Z5jdHi6"
 * createId('node') // => "node-V1StGXR8_Z5jdHi6"
 * createId({ prefix: 'edge', length: 8 }) // => "edge-V1StGXR8"
 */
export function createId(options?: string | IdOptions): string {
  let prefix: string | undefined
  let length = 16

  if (typeof options === 'string') {
    prefix = options
  } else if (options) {
    prefix = options.prefix
    length = options.length ?? 16
  }

  const id = nanoid(length)
  return prefix ? `${prefix}-${id}` : id
}
