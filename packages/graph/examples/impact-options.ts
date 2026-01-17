import { Edge, Graph, GraphStore, GraphWorkspace, Input, Node, Output, analyzeImpact } from '../src'

const n1 = new Node({
  id: 'n1',
  type: 'process',
  name: 'n1',
  inputs: [],
  outputs: [new Output({ id: 'n1-out', name: 'out', contract: { flow: 'string' } })],
})

const n2 = new Node({
  id: 'n2',
  type: 'process',
  name: 'n2',
  inputs: [new Input({ id: 'n2-in', name: 'in', contract: { flow: 'string' } })],
  outputs: [new Output({ id: 'n2-out', name: 'out', contract: { flow: 'string' } })],
})

const n3 = new Node({
  id: 'n3',
  type: 'process',
  name: 'n3',
  inputs: [new Input({ id: 'n3-in', name: 'in', contract: { flow: 'string' } })],
  outputs: [],
})

const e12 = new Edge({ id: 'e12', source: { nodeId: 'n1', endpointId: 'n1-out' }, target: { nodeId: 'n2', endpointId: 'n2-in' } })
const e23 = new Edge({ id: 'e23', source: { nodeId: 'n2', endpointId: 'n2-out' }, target: { nodeId: 'n3', endpointId: 'n3-in' } })

const workspace = new GraphWorkspace(new Graph({ nodes: [n1, n2, n3], edges: [e12, e23] }))

const patchResult = workspace.update((editor) => {
  editor.replaceNode(new Node({
    id: 'n2',
    type: 'process',
    name: 'n2-updated',
    inputs: [new Input({ id: 'n2-in', name: 'in', contract: { flow: 'string' } })],
    outputs: [new Output({ id: 'n2-out', name: 'out', contract: { flow: 'string' } })],
  }))
})

const state = GraphStore.fromGraph(patchResult.graph)

const downstreamDepth1 = analyzeImpact(state, patchResult.patch, { direction: 'downstream', depth: 1, includeSeeds: true })
console.log('Downstream depth=1:', downstreamDepth1.nodes.map((n) => n.id))

const upstream = analyzeImpact(state, patchResult.patch, { direction: 'upstream', includeSeeds: true })
console.log('Upstream:', upstream.nodes.map((n) => n.id))
