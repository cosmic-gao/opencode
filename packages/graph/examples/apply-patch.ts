import { Edge, Graph, GraphStore, GraphWorkspace, Input, Node, Output, analyzeImpact, validate } from '../src'

const node1 = new Node({
  id: 'node-1',
  type: 'process',
  name: 'Producer',
  inputs: [],
  outputs: [new Output({ id: 'out-1', name: 'out', contract: { flow: 'string' } })],
})

const node2 = new Node({
  id: 'node-2',
  type: 'process',
  name: 'Consumer',
  inputs: [new Input({ id: 'in-1', name: 'in', contract: { flow: 'string' } })],
  outputs: [],
})

const workspace = new GraphWorkspace(new Graph({ nodes: [node1, node2], edges: [] }))

const edge = new Edge({
  id: 'edge-1',
  source: { nodeId: 'node-1', endpointId: 'out-1' },
  target: { nodeId: 'node-2', endpointId: 'in-1' },
})

const patch = { edgeAdd: [edge] }
const result = workspace.applyPatch(patch)

console.log('Applied patch:', summarizePatch(result.patch))
console.log('Edges after patch:', result.graph.edges.map((e) => e.id))

const store = GraphStore.fromGraph(result.graph)
const diagnostics = validate(store, result.patch, { matchFlow: true })
console.log('Diagnostics:', diagnostics)

const impact = analyzeImpact(store, result.patch, { direction: 'both', includeSeeds: true })
console.log('Impact nodes:', impact.nodes.map((n) => n.id))

function summarizePatch(p: any): Record<string, number> {
  const nodeAdd = Array.isArray(p.nodeAdd) ? p.nodeAdd.length : 0
  const edgeAdd = Array.isArray(p.edgeAdd) ? p.edgeAdd.length : 0
  const nodeRemove = Array.isArray(p.nodeRemove) ? p.nodeRemove.length : 0
  const edgeRemove = Array.isArray(p.edgeRemove) ? p.edgeRemove.length : 0
  const nodeReplace = Array.isArray(p.nodeReplace) ? p.nodeReplace.length : 0
  const edgeReplace = Array.isArray(p.edgeReplace) ? p.edgeReplace.length : 0
  return { nodeAdd, edgeAdd, nodeRemove, edgeRemove, nodeReplace, edgeReplace }
}
