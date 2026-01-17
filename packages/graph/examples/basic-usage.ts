import { Edge, Graph, GraphStore, GraphWorkspace, Input, Node, Output, analyzeImpact, validate } from '../src'

const node1 = new Node({
  id: 'node-1',
  type: 'process',
  name: 'Start Node',
  outputs: [
    new Output({ id: 'out-1', name: 'result', contract: { flow: 'string' } })
  ],
})

const node2 = new Node({
  id: 'node-2',
  type: 'process',
  name: 'End Node',
  inputs: [
    new Input({ id: 'in-1', name: 'data', contract: { flow: 'string' } })
  ],
})

const initialGraph = new Graph({
  nodes: [node1, node2],
  edges: [],
})

console.log('Initial graph created with', initialGraph.nodes.length, 'nodes')

const workspace = new GraphWorkspace(initialGraph)

const newEdge = new Edge({
  source: { nodeId: 'node-1', endpointId: 'out-1' },
  target: { nodeId: 'node-2', endpointId: 'in-1' },
})

console.log('Applying update: adding edge...')
const result = workspace.update((editor) => {
  editor.createEdge(newEdge)
})

console.log('New graph has', result.graph.edges.length, 'edge')
console.log('New edge ID:', newEdge.id)
console.log('Patch summary:', summarizePatch(result.patch))

const store = GraphStore.fromGraph(result.graph)

const impact = analyzeImpact(store, result.patch, {
  direction: 'downstream',
  includeSeeds: true,
})
console.log('Affected nodes:', impact.nodes.map((node) => node.id))

const diagnostics = validate(store, result.patch, { matchFlow: true })
if (diagnostics.length === 0) {
  console.log('Graph is valid!')
} else {
  console.error('Graph validation failed:', diagnostics)
}

function summarizePatch(patch: any): Record<string, number> {
  const nodeAdd = Array.isArray(patch.nodeAdd) ? patch.nodeAdd.length : 0
  const edgeAdd = Array.isArray(patch.edgeAdd) ? patch.edgeAdd.length : 0
  const nodeRemove = Array.isArray(patch.nodeRemove) ? patch.nodeRemove.length : 0
  const edgeRemove = Array.isArray(patch.edgeRemove) ? patch.edgeRemove.length : 0
  const nodeReplace = Array.isArray(patch.nodeReplace) ? patch.nodeReplace.length : 0
  const edgeReplace = Array.isArray(patch.edgeReplace) ? patch.edgeReplace.length : 0
  return { nodeAdd, edgeAdd, nodeRemove, edgeRemove, nodeReplace, edgeReplace }
}
