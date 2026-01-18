# @opencode/graph

图结构建模与校验工具，提供不可变快照（Graph）、可变状态（GraphStore）、高性能查表（Lookup）与事务工作区（GraphWorkspace）。

## 安装

```bash
pnpm add @opencode/graph
```

## 快速开始

```ts
import { Graph, Node, Input, Output, Edge, GraphStore, validateAll } from '@opencode/graph'

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

const store = GraphStore.fromGraph(graph)
const diagnostics = validateAll(store, { matchFlow: true })

void diagnostics
```

## 事务更新（Workspace）

```ts
import { Graph, GraphWorkspace, Node, Input, Output, Edge } from '@opencode/graph'

const graph = new Graph({ nodes: [], edges: [] })
const workspace = new GraphWorkspace(graph)

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

  editor.createEdge(new Edge({
    id: 'edgeSourceToTarget',
    source: { nodeId: sourceNode.id, endpointId: sourceOutput.id },
    target: { nodeId: targetNode.id, endpointId: targetInput.id },
  }))
}, { matchFlow: true })

void result.graph
void result.patch
void result.diagnostics
```

## 相关文档

- 架构与不变量：[ARCHITECTURE.md](./ARCHITECTURE.md)

