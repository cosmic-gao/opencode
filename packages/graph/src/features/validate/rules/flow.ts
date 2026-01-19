import { type Edge, type Endpoint, type Patch } from '../../../core';
import type { Diagnostic, GraphState, Rule, ValidateOptions } from '../validator';

/**
 * 规则：数据流兼容性 (Flow)规则：流类型匹配
 * 确保连接的端点具有兼容的 Flow 类型。
 */
export function flowRule(options: ValidateOptions): Rule {
  const matchFlow = options.matchFlow === true;

  return {
    name: 'flow',
    evaluate(state, patch) {
      if (!matchFlow) return [];

      const diagnostics: Diagnostic[] = [];

      const edges = patch ? listEdges(state, patch) : state.listEdges;
      for (const edge of edges) {
        const output = resolveEndpoint(state, patch, edge.source.endpointId);
        const input = resolveEndpoint(state, patch, edge.target.endpointId);
        if (!output || !input) continue;

        if (output.contract.flow !== input.contract.flow) {
          diagnostics.push({
            level: 'error',
            code: 'flow',
            message: `Flow mismatch: ${output.contract.flow} -> ${input.contract.flow}`,
            target: { type: 'edge', id: edge.id },
          });
        }
      }

      return diagnostics;
    },
  };
}

function resolveEndpoint(
  state: GraphState,
  patch: Patch | undefined,
  endpointId: string,
): Endpoint | undefined {
  if (!patch) return state.getEndpoint(endpointId);

  // 1. Check patch for new/replaced nodes
  if (patch.nodeAdd) {
    for (const node of patch.nodeAdd) {
      for (const input of node.inputs) if (input.id === endpointId) return input;
      for (const output of node.outputs) if (output.id === endpointId) return output;
    }
  }
  if (patch.nodeReplace) {
    for (const node of patch.nodeReplace) {
      for (const input of node.inputs) if (input.id === endpointId) return input;
      for (const output of node.outputs) if (output.id === endpointId) return output;
    }
  }

  // 2. Check state, but ensure it's not removed/replaced
  const endpoint = state.getEndpoint(endpointId);
  if (!endpoint) return undefined;

  const nodeId = state.owner(endpointId);
  if (nodeId) {
    if (patch.nodeRemove?.includes(nodeId)) return undefined;
    // If node is replaced but we didn't find the endpoint in patch.nodeReplace above, it means the endpoint was removed
    if (patch.nodeReplace?.some((n) => n.id === nodeId)) return undefined;
  }

  return endpoint;
}

function listEdges(state: GraphState, patch: Patch): readonly Edge[] {
  const edgeMap = new Map<string, Edge>();

  // 1. Add edges from state connected to replaced nodes (potential flow changes)
  for (const node of patch.nodeReplace ?? []) {
    for (const edge of state.incoming(node.id)) edgeMap.set(edge.id, edge);
    for (const edge of state.outgoing(node.id)) edgeMap.set(edge.id, edge);
  }

  // 2. Remove deleted edges
  if (patch.edgeRemove) {
    for (const id of patch.edgeRemove) edgeMap.delete(id);
  }

  // 3. Apply Replace & Add (these take precedence)
  for (const edge of patch.edgeReplace ?? []) edgeMap.set(edge.id, edge);
  for (const edge of patch.edgeAdd ?? []) edgeMap.set(edge.id, edge);

  return [...edgeMap.values()];
}
