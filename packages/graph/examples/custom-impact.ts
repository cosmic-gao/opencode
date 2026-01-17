import { Edge, Graph, GraphStore, Input, type ImpactSemantics, Node, Output, analyzeImpact } from '../src'

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

const e12 = new Edge({
  id: 'e12',
  source: { nodeId: 'n1', endpointId: 'n1-out' },
  target: { nodeId: 'n2', endpointId: 'n2-in' },
  metadata: { impact: true },
})

const e23 = new Edge({
  id: 'e23',
  source: { nodeId: 'n2', endpointId: 'n2-out' },
  target: { nodeId: 'n3', endpointId: 'n3-in' },
  metadata: { impact: false },
})

const graph = new Graph({ nodes: [n1, n2, n3], edges: [e12, e23] })
const state = GraphStore.fromGraph(graph)

const patch = {
  nodeReplace: [new Node({ id: 'n2', type: 'process', name: 'n2-update', inputs: n2.inputs, outputs: n2.outputs })],
}

const defaultImpact = analyzeImpact(state, patch, { direction: 'downstream', includeSeeds: true })
console.log('Default impact:', defaultImpact.nodes.map((node) => node.id))

const strictSemantics: ImpactSemantics = {
  name: 'impactFlag',
  getSeeds: () => ['n2'],
  getOutgoing: (s, nodeId) => s.getNodeOutgoing(nodeId).filter((edge) => edge.metadata?.impact === true),
  getIncoming: (s, nodeId) => s.getNodeIncoming(nodeId).filter((edge) => edge.metadata?.impact === true),
}

const strictImpact = analyzeImpact(state, patch, { direction: 'downstream', includeSeeds: true }, strictSemantics)
console.log('Strict impact:', strictImpact.nodes.map((node) => node.id))
