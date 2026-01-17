import { Graph } from '../src/model/graph'
import { Node } from '../src/model/node'
import { Edge } from '../src/model/edge'
import { Input } from '../src/model/input'
import { Output } from '../src/model/output'
import { GraphWorkspace } from '../src/workspace'
import { validate } from '../src/validate/validate'

// 1. 创建初始节点
const node1 = new Node({
  id: 'node-1',
  type: 'process',
  name: 'Start Node',
  outputs: [
    new Output({ id: 'out-1', name: 'result', contract: { flow: 'string' } })
  ]
})

const node2 = new Node({
  id: 'node-2',
  type: 'process',
  name: 'End Node',
  inputs: [
    new Input({ id: 'in-1', name: 'data', contract: { flow: 'string' } })
  ]
})

// 2. 创建初始图
const initialGraph = new Graph({
  nodes: [node1, node2],
  edges: []
})

console.log('Initial graph created with', initialGraph.nodes.length, 'nodes')

// 3. 初始化工作区
const workspace = new GraphWorkspace(initialGraph)

// 4. 定义变更：添加一条连接两个节点的边
const newEdge = new Edge({
  // id: 'edge-1', // 自动生成 ID (例如 "edge-V1St...")
  source: { nodeId: 'node-1', endpointId: 'out-1' },
  target: { nodeId: 'node-2', endpointId: 'in-1' }
})

const delta = {
  addedEdges: [newEdge]
}

// 5. 应用变更
console.log('Applying delta: adding edge...')
const result = workspace.apply(delta, {
  direction: 'downstream', // 分析受影响的下游节点
  includeSeeds: true
})

// 6. 验证结果
console.log('New graph has', result.graph.edges.length, 'edge')
console.log('New edge ID:', newEdge.id)

// 7. 检查受影响的子图
console.log('Affected nodes:', result.affected.nodes.map(n => n.id))
// 预期输出: ['node-1', 'node-2'] (因为种子节点包含在内，且从 node-1 传播到 node-2)

// 8. 校验图的完整性
const diagnostics = validate(result.graph)
if (diagnostics.length === 0) {
  console.log('Graph is valid!')
} else {
  console.error('Graph validation failed:', diagnostics)
}
