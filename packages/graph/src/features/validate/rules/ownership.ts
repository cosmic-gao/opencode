import { type Edge, type Patch } from '../../../core';
import type { Diagnostic, GraphState, Rule } from '..';

/**
 * 规则：端点归属权 (Ownership)
 * 确保边引用的端点确实属于引用的节点。
 */
export function ownershipRule(): Rule {
  return {
    name: 'ownership',
    evaluate(state, patch) {
      const diagnostics: Diagnostic[] = [];

      const edges = patch ? listEdges(state, patch) : state.listEdges;
      for (const edge of edges) {
        const fromNodeId = state.owner(edge.source.endpointId);
        if (fromNodeId && fromNodeId !== edge.source.nodeId) {
          diagnostics.push({
            level: 'error',
            code: 'ownership',
            message:
              `Endpoint ${edge.source.endpointId} does not belong to node ${edge.source.nodeId}`,
            target: { type: 'edge', id: edge.id },
          });
        }

        const toNodeId = state.owner(edge.target.endpointId);
        if (toNodeId && toNodeId !== edge.target.nodeId) {
          diagnostics.push({
            level: 'error',
            code: 'ownership',
            message:
              `Endpoint ${edge.target.endpointId} does not belong to node ${edge.target.nodeId}`,
            target: { type: 'edge', id: edge.id },
          });
        }
      }

      return diagnostics;
    },
  };
}

function listEdges(state: GraphState, patch: Patch): readonly Edge[] {
  const edgeMap = new Map<string, Edge>();

  for (const edge of patch.edgeAdd ?? []) edgeMap.set(edge.id, edge);
  for (const edge of patch.edgeReplace ?? []) edgeMap.set(edge.id, edge);

  for (const node of patch.nodeReplace ?? []) {
    for (const edge of state.incoming(node.id)) edgeMap.set(edge.id, edge);
    for (const edge of state.outgoing(node.id)) edgeMap.set(edge.id, edge);
  }

  return [...edgeMap.values()];
}
