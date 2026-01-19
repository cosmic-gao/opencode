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
 * useId() // => "V1StGXR8_Z5jdHi6"
 * useId('node') // => "node-V1StGXR8_Z5jdHi6"
 * useId({ prefix: 'edge', length: 8 }) // => "edge-V1StGXR8"
 */
export function useId(options?: string | IdOptions): string {
  const { prefix, length = 16 } = typeof options === 'string'
    ? { prefix: options, length: 16 }
    : (options ?? { length: 16 })

  const id = nanoid(length)
  return prefix ? `${prefix}-${id}` : id
}
