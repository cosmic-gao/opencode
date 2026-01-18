import type { Rule } from './rule'

/**
 * 校验选项
 * 用于配置校验行为
 */
export interface ValidateOptions {
  /** 是否允许输入端点连接多条边（默认为 false，即单输入约束） */
  allowMultiple?: boolean
  /** 是否强制要求连接的端点具有相同的 Flow 类型（默认为 false） */
  matchFlow?: boolean
  /** 自定义规则列表，如果提供将覆盖默认规则 */
  rules?: readonly Rule[]
}
