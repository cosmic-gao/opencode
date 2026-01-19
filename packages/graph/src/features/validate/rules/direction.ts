import type { Edge, Patch } from '../../../core'
import type { Diagnostic, GraphState, Rule } from '..'

export const directionRule = (): Rule => ({
    name: 'direction',
    evaluate(state, patch) {
      const diagnostics: Diagnostic[] = [];

      const edges = patch ? listEdges(state, patch) : state.listEdges;
      for (const edge of edges) {
        const output = state.getOutput(edge.source.endpointId);
        if (!output) {
          diagnostics.push({
            level: 'error',
            code: 'direction',
            message: `Edge from endpoint must be output: ${edge.source.endpointId}`,
            target: { type: 'edge', id: edge.id },
          });
        }

        const input = state.getInput(edge.target.endpointId);
        if (!input) {
          diagnostics.push({
            level: 'error',
            code: 'direction',
            message: `Edge to endpoint must be input: ${edge.target.endpointId}`,
            target: { type: 'edge', id: edge.id },
          });
        }
      }

      return diagnostics;
    },
});

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
