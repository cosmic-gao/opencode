import type { Edge, Endpoint, Input, Node, Output } from '../../core/model'
import type { Patch } from '../../core/state/patch'
import type { Diagnostic } from '../../common'
import {
  cardinalityRule,
  directionRule,
  flowRule,
  identityRule,
  ownershipRule,
  referenceRule,
} from './rules'

export type { Diagnostic }

/**
 * 校验选项
 */
export interface ValidateOptions {
  allowMultiple?: boolean;
  matchFlow?: boolean;
  rules?: readonly Rule[];
}

/**
 * 图只读状态
 */
export interface GraphState {
  readonly metadata?: Record<string, unknown>;
  getNode(nodeId: string): Node | undefined;
  getEdge(edgeId: string): Edge | undefined;
  hasNode(nodeId: string): boolean;
  hasEdge(edgeId: string): boolean;
  hasEndpoint(endpointId: string): boolean;
  getEndpoint(endpointId: string): Endpoint | undefined;
  getInput(endpointId: string): Input | undefined;
  getOutput(endpointId: string): Output | undefined;
  owner(endpointId: string): string | undefined;
  endpoints(nodeId: string): readonly Endpoint[];
  readonly listNodes: IterableIterator<Node>;
  readonly listEdges: IterableIterator<Edge>;
  outgoing(nodeId: string): IterableIterator<Edge>;
  incoming(nodeId: string): IterableIterator<Edge>;
  inputEdges(inputId: string): IterableIterator<Edge>;
  outputEdges(outputId: string): IterableIterator<Edge>;
}

/**
 * 校验规则
 */
export interface Rule {
  name: string;
  evaluate: (state: GraphState, patch?: Patch) => Diagnostic[];
}

/**
 * 校验器
 */
export class Validator {
  /**
   * 增量校验
   */
  static check(state: GraphState, patch: Patch, options: ValidateOptions = {}): Diagnostic[] {
    const rules = options.rules ?? Validator.standardRules(options);
    const diagnostics: Diagnostic[] = [];
    for (const rule of rules) {
      diagnostics.push(...rule.evaluate(state, patch));
    }
    return diagnostics;
  }

  /**
   * 全量校验
   */
  static checkAll(state: GraphState, options: ValidateOptions = {}): Diagnostic[] {
    const rules = options.rules ?? Validator.standardRules(options);
    const diagnostics: Diagnostic[] = [];
    for (const rule of rules) {
      diagnostics.push(...rule.evaluate(state));
    }
    return diagnostics;
  }

  /**
   * 获取默认规则
   */
  static defaultRules(options: ValidateOptions): Rule[] {
    return Validator.standardRules(options);
  }

  private static standardRules(options: ValidateOptions): Rule[] {
    return [
      identityRule(),
      referenceRule(),
      directionRule(),
      ownershipRule(),
      cardinalityRule(options),
      flowRule(options),
    ];
  }
}
