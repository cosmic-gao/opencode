import type { Edge } from '../../model'
import type { Store, Patch } from '../../state'
import type { Diagnostic } from '../diagnostic'
import type { Rule } from '../rule'

/**
 * 规则：连接方向
 * 确保边是从 Output 连接到 Input。
 */
export function directionRule(): Rule {
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

function listEdges(state: Store, patch: Patch): readonly Edge[] {
  const edgeMap = new Map<string, Edge>()

  for (const edge of patch.edgeAdd ?? []) edgeMap.set(edge.id, edge)
  for (const edge of patch.edgeReplace ?? []) edgeMap.set(edge.id, edge)

  for (const node of patch.nodeReplace ?? []) {
    for (const edge of state.incoming(node.id)) edgeMap.set(edge.id, edge)
    for (const edge of state.outgoing(node.id)) edgeMap.set(edge.id, edge)
  }


  return [...edgeMap.values()]
}

