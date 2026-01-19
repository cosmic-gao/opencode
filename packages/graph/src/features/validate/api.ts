import { type Graph, Store } from '../../core';
import { type Diagnostic, type Rule, type ValidateOptions, Validator } from './validator';

/**
 * 在不可变图快照上执行全量校验。
 *
 * @param graph - 不可变图快照
 * @param options - 校验选项
 * @returns 诊断列表
 */
export function validateGraph(graph: Graph, options: ValidateOptions = {}): Diagnostic[] {
  const state = Store.from(graph);
  return Validator.checkAll(state, options);
}

/**
 * 获取默认的校验规则集。
 *
 * @param options - 校验选项
 * @returns 规则列表
 */
export function defaultRules(options: ValidateOptions): Rule[] {
  return Validator.defaultRules(options);
}
