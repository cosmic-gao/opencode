import type { Patch } from '../../core/state/patch'
import type { Diagnostic } from './diagnostic'
import type { Rule } from './rule'
import type { ValidateOptions } from './options'
import type { GraphState } from './state'

import {
  cardinalityRule,
  directionRule,
  flowRule,
  identityRule,
  ownershipRule,
  referenceRule,
} from './rules'

export type { ValidateOptions }

/**
 * 校验图对象的结构一致性。
 * 支持增量校验，仅检查受 Patch 影响的部分。
 *
 * @param state - 图状态（唯一事实源）
 * @param patch - 事实补丁
 * @param options - 校验选项，可配置启用的规则
 * @returns 诊断列表，包含发现的错误或警告
 *
 * @example
 * const diagnostics = check(store, patch);
 * if (diagnostics.length > 0) {
 *   console.error('Validation failed:', diagnostics);
 * }
 */
export function check(state: GraphState, patch: Patch, options: ValidateOptions = {}): Diagnostic[] {
  const rules = options.rules ?? standardRules(options)

  const diagnostics: Diagnostic[] = []


  for (const rule of rules) {
    diagnostics.push(...rule.evaluate(state, patch))
  }

  return diagnostics
}

/**
 * 全量校验。
 * 检查整个图的所有规则。
 *
 * @param state - 图状态（唯一事实源）
 * @param options - 校验选项
 * @returns 诊断列表
 *
 * @example
 * const diagnostics = checkAll(store);
 */
export function checkAll(state: GraphState, options: ValidateOptions = {}): Diagnostic[] {
  const rules = options.rules ?? standardRules(options)
  const diagnostics: Diagnostic[] = []
  for (const rule of rules) {

    diagnostics.push(...rule.evaluate(state))
  }
  return diagnostics
}

/**
 * 获取默认的校验规则集。
 *
 * @param options - 校验选项
 * @returns 规则列表
 */
export function defaultRules(options: ValidateOptions): Rule[] {
  return standardRules(options)
}


function standardRules(options: ValidateOptions): Rule[] {
  return [
    identityRule(),
    referenceRule(),
    directionRule(),
    ownershipRule(),
    cardinalityRule(options),
    flowRule(options),
  ]
}
