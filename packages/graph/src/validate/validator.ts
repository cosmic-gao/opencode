import type { Patch } from '../state/patch'
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
 *
 * @param state - 图状态（唯一事实源）
 * @param patch - 事实补丁
 * @param options - 校验选项
 * @returns 诊断列表
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
 *
 * @param state - 图状态（唯一事实源）
 * @param options - 校验选项
 * @returns 诊断列表
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

