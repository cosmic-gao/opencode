import { Edge, Graph, GraphWorkspace, Input, Node, Output } from '../src'

const node1 = new Node({
  id: 'node-1',
  type: 'process',
  name: 'Left',
  inputs: [new Input({ id: 'in-1', name: 'in', contract: { flow: 'string' } })],
  outputs: [new Output({ id: 'out-1', name: 'out', contract: { flow: 'string' } })],
})

const node2 = new Node({
  id: 'node-2',
  type: 'process',
  name: 'Right',
  inputs: [new Input({ id: 'in-2', name: 'in', contract: { flow: 'string' } })],
  outputs: [new Output({ id: 'out-2', name: 'out', contract: { flow: 'string' } })],
})

const workspace = new GraphWorkspace(new Graph({ nodes: [node1, node2], edges: [] }))

console.log('Edges before:', workspace.graph.edges.length)

try {
  workspace.update((editor) => {
    editor.createEdge(new Edge({
      id: 'edge-invalid',
      source: { nodeId: 'node-1', endpointId: 'in-1' },
      target: { nodeId: 'node-2', endpointId: 'out-2' },
    }))
  })
} catch (error) {
  console.log('Update failed:', error instanceof Error ? error.message : String(error))
}

console.log('Edges after rollback:', workspace.graph.edges.length)

