import { Edge, Graph, GraphWorkspace, Input, Node, Output } from '../src/index.ts'

const workspace = new GraphWorkspace(new Graph({ nodes: [], edges: [] }))

const result = workspace.update((editor) => {
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

  editor.createNode(sourceNode)
  editor.createNode(targetNode)

  const edge = new Edge({
    id: 'edgeSourceToTarget',
    source: { nodeId: sourceNode.id, endpointId: sourceOutput.id },
    target: { nodeId: targetNode.id, endpointId: targetInput.id },
  })

  editor.createEdge(edge)
}, { matchFlow: true })

void result.graph
void result.patch
void result.diagnostics

