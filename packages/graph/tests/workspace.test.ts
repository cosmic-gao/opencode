import assert from 'node:assert/strict'
import { Edge, Graph, GraphWorkspace, Input, Node, Output } from '../src'

const node1 = new Node({
  id: 'node-1',
  type: 'process',
  name: 'Left',
  inputs: [],
  outputs: [new Output({ id: 'out-1', name: 'out', contract: { flow: 'string' } })],
})

const node2 = new Node({
  id: 'node-2',
  type: 'process',
  name: 'Right',
  inputs: [new Input({ id: 'in-1', name: 'in', contract: { flow: 'string' } })],
  outputs: [],
})

const workspace = new GraphWorkspace(new Graph({ nodes: [node1, node2], edges: [] }))

const edge = new Edge({
  id: 'edge-1',
  source: { nodeId: 'node-1', endpointId: 'out-1' },
  target: { nodeId: 'node-2', endpointId: 'in-1' },
})

workspace.update((editor) => {
  editor.createEdge(edge)
})

assert.equal(workspace.graph.edges.length, 1)

workspace.update((editor) => {
  editor.replaceNode(new Node({ id: 'node-2', type: 'process', name: 'Right2', inputs: node2.inputs, outputs: node2.outputs }))
})

assert.equal(workspace.graph.edges.length, 1)

let isThrow = false
try {
  workspace.update((editor) => {
    editor.createEdge(new Edge({
      id: 'edge-invalid',
      source: { nodeId: 'node-1', endpointId: 'in-1' },
      target: { nodeId: 'node-2', endpointId: 'out-1' },
    }))
  })
} catch {
  isThrow = true
}

assert.equal(isThrow, true)
assert.equal(workspace.graph.edges.length, 1)

workspace.update((editor) => {
  editor.removeNode('node-1')
})

assert.equal(workspace.graph.nodes.length, 1)
assert.equal(workspace.graph.edges.length, 0)

