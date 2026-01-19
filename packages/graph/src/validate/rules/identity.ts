import type { Diagnostic } from '../diagnostic'
import type { Rule } from '../rule'
import type { GraphState } from '../state'

/**
 * 规则：ID 唯一性
 * 确保图中的节点、边和端点 ID 不重复。
 */
export function identityRule(): Rule {
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

function checkNodeIds(state: GraphState, nodeIdSet: Set<string>): Diagnostic[] {
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
  state: GraphState,
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

function checkEdgeIds(state: GraphState, edgeIdSet: Set<string>): Diagnostic[] {
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
