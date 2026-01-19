
import { 
  Store, 
  Node, 
  Edge, 
  Input, 
  Output, 
  Contract,
  Reference
} from './src';

// 1. 定义契约 (Contracts)
// 契约定义了数据流的类型，确保连接的兼容性
const numberContract = new Contract({ flow: 'number' });
const stringContract = new Contract({ flow: 'string' });

// 2. 创建节点 (Nodes)

// 节点 A: 数字生成器
// 它有一个输出端口 'out'，产生数字
const nodeA = new Node({
  id: 'node-a',
  type: 'generator',
  name: 'Number Generator',
  outputs: [
    new Output({
      id: 'out',
      name: 'Output',
      contract: numberContract
    })
  ]
});

// 节点 B: 数字处理器
// 它有一个输入端口 'in' (接收数字) 和一个输出端口 'result' (输出字符串)
const nodeB = new Node({
  id: 'node-b',
  type: 'processor',
  name: 'Number to String',
  inputs: [
    new Input({
      id: 'in',
      name: 'Input',
      contract: numberContract
    })
  ],
  outputs: [
    new Output({
      id: 'result',
      name: 'Result',
      contract: stringContract
    })
  ]
});

console.log('--- 1. Initializing Store ---');

// 3. 初始化 Store
// Store 是图数据的单一事实源，管理节点和边
const store = new Store({
  nodes: [nodeA, nodeB]
});

console.log(`Store created with ${store.toGraph().nodes.size} nodes.`);

// 4. 创建连接 (Edge)
// 连接 nodeA 的 'out' 到 nodeB 的 'in'
const edge1 = new Edge({
  source: { nodeId: nodeA.id, endpointId: 'out' },
  target: { nodeId: nodeB.id, endpointId: 'in' }
});

console.log('\n--- 2. Applying Patch (Add Edge) ---');

// 5. 应用变更 (Patch)
// Store 是不可变的，必须通过 Patch 来修改状态
store.apply({
  edgeAdd: [edge1]
});

console.log(`Edge added: ${edge1.id}`);
console.log(`Total edges: ${store.toGraph().edges.size}`);

// 6. 查询图结构 (Query)
console.log('\n--- 3. Querying the Graph ---');

// 查询 nodeA 的出边
const outgoingEdges = Array.from(store.outgoing(nodeA.id));
console.log(`Node A outgoing edges: ${outgoingEdges.length}`);
outgoingEdges.forEach(e => {
  console.log(`  - Edge ${e.id}: ${e.source.nodeId}:${e.source.endpointId} -> ${e.target.nodeId}:${e.target.endpointId}`);
});

// 查询 nodeB 的入边
const incomingEdges = Array.from(store.incoming(nodeB.id));
console.log(`Node B incoming edges: ${incomingEdges.length}`);

// 7. 序列化 (Serialization)
console.log('\n--- 4. Serialization ---');
const graphValue = store.toGraph().toValue();
console.log('Graph JSON structure (simplified):');
console.log(JSON.stringify({
  nodes: graphValue.nodes.map(n => n.id),
  edges: graphValue.edges.map(e => ({ id: e.id, source: e.source, target: e.target }))
}, null, 2));
