import type { Edge } from '../model'
import type { GraphStore, Patch } from '../state'
import type { Diagnostic } from './diagnostic'
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

/**
 * 校验图对象的结构一致性。
 *
 * 该方法只验证“描述是否自洽”（引用存在、方向、归属、基础约束），不包含任何执行或调度逻辑。
 * 它通过一系列 Rule 对图进行检查。
 *
 * @param state - 图状态（唯一事实源）
 * @param patch - 事实补丁
 * @param options - 校验选项
 * @returns 诊断列表（可直接用于 UI 展示）
 */
export function validate(state: GraphStore, patch: Patch, options: ValidateOptions = {}): Diagnostic[] {
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
export function validateAll(state: GraphStore, options: ValidateOptions = {}): Diagnostic[] {
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

/**
 * 规则：ID 唯一性
 * 确保图中的节点、边和端点 ID 不重复。
 */
function identityRule(): Rule {
  return {
    name: 'identity',
    evaluate(state, patch) {
      if (patch) return []

      const nodeIdSet = new Set<string>()
      const endpointIdSet = new Set<string>()
      const edgeIdSet = new Set<string>()

      return [
        ...checkNodeIds(state, nodeIdSet),
        ...checkEndpointIds(state, endpointIdSet),
        ...checkEdgeIds(state, edgeIdSet),
      ]
    },
  }
}

function checkNodeIds(state: GraphStore, nodeIdSet: Set<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const node of state.listNodes()) {
    if (nodeIdSet.has(node.id)) {
      diagnostics.push({
        level: 'error',
        code: 'identity',
        message: `Duplicate node id: ${node.id}`,
        target: { type: 'node', id: node.id },
      })
      continue
    }

    nodeIdSet.add(node.id)
  }

  return diagnostics
}

function checkEndpointIds(
  state: GraphStore,
  endpointIdSet: Set<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const node of state.listNodes()) {
    for (const endpoint of node.inputs) {
      diagnostics.push(
        ...checkEndpointId(endpoint.id, endpointIdSet),
      )
    }
    for (const endpoint of node.outputs) {
      diagnostics.push(
        ...checkEndpointId(endpoint.id, endpointIdSet),
      )
    }
  }

  return diagnostics
}

function checkEndpointId(
  endpointId: string,
  endpointIdSet: Set<string>,
): Diagnostic[] {
  if (!endpointIdSet.has(endpointId)) {
    endpointIdSet.add(endpointId)
    return []
  }

  return [
    {
      level: 'error',
      code: 'identity',
      message: `Duplicate endpoint id: ${endpointId}`,
      target: { type: 'endpoint', id: endpointId },
    },
  ]
}

function checkEdgeIds(state: GraphStore, edgeIdSet: Set<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const edge of state.listEdges()) {
    if (edgeIdSet.has(edge.id)) {
      diagnostics.push({
        level: 'error',
        code: 'identity',
        message: `Duplicate edge id: ${edge.id}`,
        target: { type: 'edge', id: edge.id },
      })
      continue
    }

    edgeIdSet.add(edge.id)
  }

  return diagnostics
}

/**
 * 规则：引用完整性
 * 确保边引用的节点和端点真实存在。
 */
function referenceRule(): Rule {
  return {
    name: 'reference',
    evaluate(state, patch) {
      const edges = patch ? listEdges(state, patch) : state.listEdges()
      return edges.flatMap((edge) => checkReference(edge, state))
    },
  }
}

function checkReference(edge: Edge, state: GraphStore): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  const fromNode = state.getNode(edge.source.nodeId)
  if (!fromNode) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing node: ${edge.source.nodeId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  const toNode = state.getNode(edge.target.nodeId)
  if (!toNode) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing node: ${edge.target.nodeId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  const fromEndpoint = state.getEndpoint(edge.source.endpointId)
  if (!fromEndpoint) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing endpoint: ${edge.source.endpointId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  const toEndpoint = state.getEndpoint(edge.target.endpointId)
  if (!toEndpoint) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing endpoint: ${edge.target.endpointId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  return diagnostics
}

/**
 * 规则：连接方向
 * 确保边是从 Output 连接到 Input。
 */
function directionRule(): Rule {
  return {
    name: 'direction',
    evaluate(state, patch) {
      const diagnostics: Diagnostic[] = []

      const edges = patch ? listEdges(state, patch) : state.listEdges()
      for (const edge of edges) {
        const output = state.getOutput(edge.source.endpointId)
        if (!output) {
          diagnostics.push({
            level: 'error',
            code: 'direction',
            message: `Edge from endpoint must be output: ${edge.source.endpointId}`,
            target: { type: 'edge', id: edge.id },
          })
        }

        const input = state.getInput(edge.target.endpointId)
        if (!input) {
          diagnostics.push({
            level: 'error',
            code: 'direction',
            message: `Edge to endpoint must be input: ${edge.target.endpointId}`,
            target: { type: 'edge', id: edge.id },
          })
        }
      }

      return diagnostics
    },
  }
}

/**
 * 规则：端点归属
 * 确保边引用的端点确实属于引用的节点。
 */
function ownershipRule(): Rule {
  return {
    name: 'ownership',
    evaluate(state, patch) {
      const diagnostics: Diagnostic[] = []

      const edges = patch ? listEdges(state, patch) : state.listEdges()
      for (const edge of edges) {
        const fromNodeId = state.getEndpointNodeId(edge.source.endpointId)
        if (fromNodeId && fromNodeId !== edge.source.nodeId) {
          diagnostics.push({
            level: 'error',
            code: 'ownership',
            message: `Endpoint ${edge.source.endpointId} does not belong to node ${edge.source.nodeId}`,
            target: { type: 'edge', id: edge.id },
          })
        }

        const toNodeId = state.getEndpointNodeId(edge.target.endpointId)
        if (toNodeId && toNodeId !== edge.target.nodeId) {
          diagnostics.push({
            level: 'error',
            code: 'ownership',
            message: `Endpoint ${edge.target.endpointId} does not belong to node ${edge.target.nodeId}`,
            target: { type: 'edge', id: edge.id },
          })
        }
      }

      return diagnostics
    },
  }
}

/**
 * 规则：输入基数
 * 确保输入端点最多连接一条边（除非配置允许）。
 */
function cardinalityRule(options: ValidateOptions): Rule {
  const allowMultiple = options.allowMultiple === true

  return {
    name: 'cardinality',
    evaluate(state, patch) {
      if (allowMultiple) return []

      const inputIds = patch ? listInputs(state, patch) : state.listNodes().flatMap((node) => node.inputs.map((input) => input.id))
      const diagnostics: Diagnostic[] = []
      for (const inputId of inputIds) {
        const incoming = state.getIncomingEdges(inputId)
        if (incoming.length > 1) {
          diagnostics.push({ level: 'error', code: 'cardinality', message: `Input endpoint has multiple incoming edges: ${inputId}`, target: { type: 'endpoint', id: inputId } })
        }
      }
      return diagnostics
    },
  }
}

/**
 * 规则：流类型匹配
 * 确保连接的端点具有兼容的 Flow 类型。
 */
function flowRule(options: ValidateOptions): Rule {
  const matchFlow = options.matchFlow === true

  return {
    name: 'flow',
    evaluate(state, patch) {
      if (!matchFlow) return []

      const diagnostics: Diagnostic[] = []

      const edges = patch ? listEdges(state, patch) : state.listEdges()
      for (const edge of edges) {
        const output = state.getOutput(edge.source.endpointId)
        const input = state.getInput(edge.target.endpointId)
        if (!output || !input) continue

        if (output.contract.flow !== input.contract.flow) {
          diagnostics.push({
            level: 'error',
            code: 'flow',
            message: `Flow mismatch: ${output.contract.flow} -> ${input.contract.flow}`,
            target: { type: 'edge', id: edge.id },
          })
        }
      }

      return diagnostics
    },
  }
}

function listEdges(state: GraphStore, patch: Patch): readonly Edge[] {
  const edgeMap = new Map<string, Edge>()

  for (const edge of patch.edgeAdd ?? []) edgeMap.set(edge.id, edge)
  for (const edge of patch.edgeReplace ?? []) edgeMap.set(edge.id, edge)

  for (const node of patch.nodeReplace ?? []) {
    for (const edge of state.getNodeIncoming(node.id)) edgeMap.set(edge.id, edge)
    for (const edge of state.getNodeOutgoing(node.id)) edgeMap.set(edge.id, edge)
  }

  return [...edgeMap.values()]
}

function listInputs(state: GraphStore, patch: Patch): readonly string[] {
  const inputIdSet = new Set<string>()

  for (const edge of patch.edgeAdd ?? []) inputIdSet.add(edge.target.endpointId)
  for (const edge of patch.edgeReplace ?? []) inputIdSet.add(edge.target.endpointId)

  for (const node of patch.nodeReplace ?? []) {
    const current = state.getNode(node.id)
    if (!current) continue
    for (const input of current.inputs) inputIdSet.add(input.id)
  }

  for (const node of patch.nodeAdd ?? []) {
    for (const input of node.inputs) inputIdSet.add(input.id)
  }

  return [...inputIdSet]
}
