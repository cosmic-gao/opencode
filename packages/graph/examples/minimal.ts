import { Edge, Graph, Input, Lookup, Node, Output, Store, checkAll } from '../src/index.ts'

const sourceOutput = new Output({
  id: 'sourceOutput',
  name: 'output',
  contract: { flow: 'json' },
})

const sourceNode = new Node({
  id: 'sourceNode',
  type: 'source',
  outputs: [sourceOutput],
})

const targetInput = new Input({
  id: 'targetInput',
  name: 'input',
  contract: { flow: 'json' },
})

const targetNode = new Node({
  id: 'targetNode',
  type: 'target',
  inputs: [targetInput],
})

const edge = new Edge({
  id: 'edgeSourceToTarget',
  source: { nodeId: sourceNode.id, endpointId: sourceOutput.id },
  target: { nodeId: targetNode.id, endpointId: targetInput.id },
})

const graph = new Graph({ nodes: [sourceNode, targetNode], edges: [edge] })

const lookup = new Lookup(graph)
const store = Store.from(graph)
const diagnostics = checkAll(store, { matchFlow: true })

const resolvedSource = lookup.getNode(sourceNode.id)
const resolvedEdge = lookup.getEdge(edge.id)

void diagnostics
void resolvedSource
void resolvedEdge
