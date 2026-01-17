import type { Edge } from '../model/edge'
import type { GraphDefinition } from '../model/graph-definition'
import type { LookupView } from '../lookup/view'
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
 * @param graph - 图对象 (GraphDefinition)
 * @param options - 校验选项
 * @returns 诊断列表（可直接用于 UI 展示）
 */
export function validate(graph: GraphDefinition, options: ValidateOptions = {}): Diagnostic[] {
  const lookup = graph.lookup()
  const rules = options.rules ?? standardRules(options)

  const diagnostics: Diagnostic[] = []

  for (const rule of rules) {
    diagnostics.push(...rule.evaluate(graph, lookup))
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
    evaluate(graph) {
      const nodeIdSet = new Set<string>()
      const endpointIdSet = new Set<string>()
      const edgeIdSet = new Set<string>()

      return [
        ...checkNodeIds(graph, nodeIdSet),
        ...checkEndpointIds(graph, endpointIdSet),
        ...checkEdgeIds(graph, edgeIdSet),
      ]
    },
  }
}

function checkNodeIds(graph: GraphDefinition, nodeIdSet: Set<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const node of graph.nodes) {
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
  graph: GraphDefinition,
  endpointIdSet: Set<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const node of graph.nodes) {
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

function checkEdgeIds(graph: GraphDefinition, edgeIdSet: Set<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const edge of graph.edges) {
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
    evaluate(graph, lookup) {
      const diagnostics: Diagnostic[] = []

      for (const edge of graph.edges) {
        diagnostics.push(...checkReference(edge, lookup))
      }

      return diagnostics
    },
  }
}

function checkReference(edge: Edge, lookup: LookupView): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  const fromNode = lookup.getNode(edge.source.nodeId)
  if (!fromNode) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing node: ${edge.source.nodeId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  const toNode = lookup.getNode(edge.target.nodeId)
  if (!toNode) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing node: ${edge.target.nodeId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  const fromEndpoint = lookup.getEndpoint(edge.source.endpointId)
  if (!fromEndpoint) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing endpoint: ${edge.source.endpointId}`,
      target: { type: 'edge', id: edge.id },
    })
  }

  const toEndpoint = lookup.getEndpoint(edge.target.endpointId)
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
    evaluate(graph, lookup) {
      const diagnostics: Diagnostic[] = []

      for (const edge of graph.edges) {
        const output = lookup.getOutput(edge.source.endpointId)
        if (!output) {
          diagnostics.push({
            level: 'error',
            code: 'direction',
            message: `Edge from endpoint must be output: ${edge.source.endpointId}`,
            target: { type: 'edge', id: edge.id },
          })
        }

        const input = lookup.getInput(edge.target.endpointId)
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
    evaluate(graph, lookup) {
      const diagnostics: Diagnostic[] = []

      for (const edge of graph.edges) {
        const fromNodeId = lookup.getEndpointNodeId(edge.source.endpointId)
        if (fromNodeId && fromNodeId !== edge.source.nodeId) {
          diagnostics.push({
            level: 'error',
            code: 'ownership',
            message: `Endpoint ${edge.source.endpointId} does not belong to node ${edge.source.nodeId}`,
            target: { type: 'edge', id: edge.id },
          })
        }

        const toNodeId = lookup.getEndpointNodeId(edge.target.endpointId)
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
    evaluate(graph, lookup) {
      if (allowMultiple) return []

      const diagnostics: Diagnostic[] = []

      for (const node of graph.nodes) {
        for (const input of node.inputs) {
          const incomingEdges = lookup.getIncomingEdges(input.id)
          if (incomingEdges.length > 1) {
            diagnostics.push({
              level: 'error',
              code: 'cardinality',
              message: `Input endpoint has multiple incoming edges: ${input.id}`,
              target: { type: 'endpoint', id: input.id },
            })
          }
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
    evaluate(graph, lookup) {
      if (!matchFlow) return []

      const diagnostics: Diagnostic[] = []

      for (const edge of graph.edges) {
        const output = lookup.getOutput(edge.source.endpointId)
        const input = lookup.getInput(edge.target.endpointId)
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
