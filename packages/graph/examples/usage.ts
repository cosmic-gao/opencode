import {
  Graph,
  Node,
  Edge,
  Input,
  Output,
  Contract,
  Workspace,
  Lookup,
} from '../src'

/**
 * Graph Library 功能演示
 *
 * 本示例演示了 Graph 库的核心功能，包括：
 * 1. 定义节点和契约
 * 2. 使用 Workspace 进行事务性编辑
 * 3. 校验机制与错误处理
 * 4. 使用 Lookup 进行图查询
 * 5. 序列化与反序列化
 */

async function main() {
  console.log('=== Graph Library Demo ===\n')

  // --- 1. 定义基础模型 ---
  console.log('1. 定义节点...')

  // 定义通用的契约 (Contract)
  // 契约定义了数据流的类型，只有兼容的契约才能连接
  const numberContract = new Contract({ flow: 'number' })
  const stringContract = new Contract({ flow: 'string' })

  // 创建 "Source" 节点：产生数字
  const sourceNode = new Node({
    id: 'node-source',
    type: 'source',
    name: 'Number Generator',
    outputs: [
      new Output({
        id: 'out-source-1',
        name: 'Result',
        contract: numberContract,
      }),
    ],
  })

  // 创建 "Process" 节点：处理数字，转换为字符串
  const processNode = new Node({
    id: 'node-process',
    type: 'processor',
    name: 'Number to String',
    inputs: [
      new Input({
        id: 'in-process-1',
        name: 'Number In',
        contract: numberContract,
      }),
    ],
    outputs: [
      new Output({
        id: 'out-process-1',
        name: 'String Out',
        contract: stringContract,
      }),
    ],
  })

  // 创建 "Sink" 节点：接收字符串
  const sinkNode = new Node({
    id: 'node-sink',
    type: 'sink',
    name: 'Console Log',
    inputs: [
      new Input({
        id: 'in-sink-1',
        name: 'Message In',
        contract: stringContract,
      }),
    ],
  })

  console.log('   已定义节点:', [sourceNode.name, processNode.name, sinkNode.name].join(', '))


  // --- 2. 初始化工作区 ---
  console.log('\n2. 初始化 Workspace...')

  // 创建一个空的 Graph
  const initialGraph = new Graph({ nodes: [], edges: [] })
  // 基于 Graph 创建 Workspace
  const workspace = new Workspace(initialGraph)


  // --- 3. 事务性编辑 (正常流程) ---
  console.log('\n3. 执行事务性更新 (添加节点和边)...')

  try {
    const result = workspace.update((editor) => {
      // 添加节点
      editor.createNode(sourceNode)
      editor.createNode(processNode)
      editor.createNode(sinkNode)

      // 添加边：Source -> Process
      editor.createEdge(new Edge({
        id: 'edge-1',
        source: { nodeId: sourceNode.id, endpointId: 'out-source-1' },
        target: { nodeId: processNode.id, endpointId: 'in-process-1' },
      }))

      // 添加边：Process -> Sink
      editor.createEdge(new Edge({
        id: 'edge-2',
        source: { nodeId: processNode.id, endpointId: 'out-process-1' },
        target: { nodeId: sinkNode.id, endpointId: 'in-sink-1' },
      }))
    })

    console.log('   更新成功!')
    console.log(`   当前图状态: ${result.graph.nodes.length} Nodes, ${result.graph.edges.length} Edges`)
  } catch (e) {
    console.error('   更新失败:', e)
  }


  // --- 4. 演示校验机制 (尝试非法操作) ---
  console.log('\n4. 演示校验机制 (尝试非法操作)...')

  try {
    workspace.update((editor) => {
      // 尝试创建一个非法边：连接两个类型不匹配的端点 (Number -> String)
      // 或者演示基数校验：尝试给 processNode 的 in-1 再接一条边 (Fan-in > 1)
      
      const extraNode = new Node({
        id: 'node-extra',
        type: 'source',
        outputs: [new Output({ id: 'out-extra-1', name: 'X', contract: numberContract })]
      })
      editor.createNode(extraNode)

      // Process 的 in-process-1 已经连接了 edge-1，再次连接会导致 cardinality 错误
      console.log('   尝试违反基数限制 (Input 连接多条边)...')
      editor.createEdge(new Edge({
        id: 'edge-illegal',
        source: { nodeId: extraNode.id, endpointId: 'out-extra-1' },
        target: { nodeId: processNode.id, endpointId: 'in-process-1' },
      }))
    })
  } catch (error: any) {
    console.log('   捕获到预期错误:')
    console.log('   Error Message:', error.message)
  }


  // --- 5. 图查询 (Lookup) ---
  console.log('\n5. 使用 Lookup 进行查询...')

  // 从当前图快照创建 Lookup 索引
  const lookup = new Lookup(workspace.graph)

  // 查询节点
  const node = lookup.getNode(processNode.id)
  console.log(`   查找到节点: ${node?.name} (${node?.id})`)

  // 查询连接关系
  const incomingEdges = [...lookup.incoming(processNode.id)]
  const outgoingEdges = [...lookup.outgoing(processNode.id)]
  
  console.log(`   Incoming Edges to Process: ${incomingEdges.length}`)
  console.log(`   Outgoing Edges from Process: ${outgoingEdges.length}`)
  
  if (incomingEdges.length > 0) {
    const edge = incomingEdges[0]
    const sourceNodeId = lookup.owner(edge.source.endpointId)
    const source = lookup.getNode(sourceNodeId!)
    console.log(`   数据来源: ${source?.name}`)
  }


  // --- 6. 序列化与反序列化 ---
  console.log('\n6. 序列化...')

  const json = workspace.graph.toValue()
  console.log('   Graph JSON Snapshot (简略):')
  console.log(JSON.stringify({
    nodes: json.nodes.length,
    edges: json.edges.length,
    sampleNode: json.nodes[0].id
  }, null, 2))

  console.log('\n=== Demo 完成 ===')
}

// 运行示例
main().catch(console.error)
