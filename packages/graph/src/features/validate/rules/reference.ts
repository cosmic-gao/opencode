import { type Edge, type Patch } from '../../../core';
import type { Diagnostic, GraphState, Rule } from '../validator';

/**
 * 规则：引用完整性 (Reference)
 * 确保边引用的节点和端点真实存在。
 */
export function referenceRule(): Rule {
  return {
    name: 'reference',
    evaluate(state, patch) {
      const edges = patch ? listEdges(state, patch) : state.listEdges;
      const diagnostics: Diagnostic[] = [];

      for (const edge of edges) {
        diagnostics.push(...checkReference(edge, state));
      }

      return diagnostics;
    },
  };
}

function checkReference(edge: Edge, state: GraphState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const fromNode = state.getNode(edge.source.nodeId);
  if (!fromNode) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing node: ${edge.source.nodeId}`,
      target: { type: 'edge', id: edge.id },
    });
  }

  const toNode = state.getNode(edge.target.nodeId);
  if (!toNode) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing node: ${edge.target.nodeId}`,
      target: { type: 'edge', id: edge.id },
    });
  }

  const fromEndpoint = state.getEndpoint(edge.source.endpointId);
  if (!fromEndpoint) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing endpoint: ${edge.source.endpointId}`,
      target: { type: 'edge', id: edge.id },
    });
  }

  const toEndpoint = state.getEndpoint(edge.target.endpointId);
  if (!toEndpoint) {
    diagnostics.push({
      level: 'error',
      code: 'reference',
      message: `Missing endpoint: ${edge.target.endpointId}`,
      target: { type: 'edge', id: edge.id },
    });
  }

  return diagnostics;
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
