import type { Edge } from '../../model'
import type { Patch } from '../../state/patch'
import type { Diagnostic } from '../diagnostic'
import type { Rule } from '../rule'
import type { ValidateOptions } from '../options'
import type { GraphState } from '../state'


/**
 * 规则：输入基数
 * 确保输入端点最多连接一条边（除非配置允许）。
 */
export function cardinalityRule(options: ValidateOptions): Rule {
  const allowMultiple = options.allowMultiple === true

  return {
    name: 'cardinality',
    evaluate(state, patch) {
      if (allowMultiple) return []

      const inputIds = patch ? listInputs(state, patch) : state.listNodes().flatMap((node) => node.inputs.map((input) => input.id))
      const diagnostics: Diagnostic[] = []
      for (const inputId of inputIds) {
        const incoming = getIncomingEdges(state, patch, inputId)
        if (incoming.length > 1) {
          diagnostics.push({ level: 'error', code: 'cardinality', message: `Input endpoint has multiple incoming edges: ${inputId}`, target: { type: 'endpoint', id: inputId } })
        }
      }
      return diagnostics
    },
  }
}

function getIncomingEdges(state: GraphState, patch: Patch | undefined, inputId: string): Edge[] {
  if (!patch) return [...state.inputEdges(inputId)]

  const edges = new Map<string, Edge>()

  // 1. Load existing
  for (const edge of state.inputEdges(inputId)) {
    edges.set(edge.id, edge)
  }

  // 2. Remove
  if (patch.edgeRemove) {
    for (const id of patch.edgeRemove) edges.delete(id)
  }

  // 3. Replace & Add
  const processEdge = (edge: Edge) => {
    if (edge.target.endpointId === inputId) {
      edges.set(edge.id, edge)
    } else if (edges.has(edge.id)) {
      // If the edge existed and pointed to inputId, but now points elsewhere (or is just replaced),
      // processEdge handles adding it back if it still points here.
      // If it points elsewhere, we need to remove it from our list of edges for *this* inputId.
      edges.delete(edge.id)
    }
  }

  if (patch.edgeReplace) for (const edge of patch.edgeReplace) processEdge(edge)
  if (patch.edgeAdd) for (const edge of patch.edgeAdd) processEdge(edge)

  return [...edges.values()]
}

function listInputs(state: GraphState, patch: Patch): readonly string[] {
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

