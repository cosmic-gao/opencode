import type { Diagnostic, GraphState, Rule } from '..'

/**
 * 规则：标识符唯一性 (Identity)
 * 确保图中的节点、边和端点 ID 不重复。
 */
export const identityRule = (): Rule => ({
    name: 'identity',
    evaluate(state, patch) {
      // 增量校验逻辑
      if (patch) {
        const diagnostics: Diagnostic[] = []
        
        // 1. 检查新增节点 ID 是否冲突
        if (patch.nodeAdd) {
          for (const node of patch.nodeAdd) {
            if (state.hasNode(node.id)) {
              diagnostics.push({
                level: 'error',
                code: 'identity',
                message: `Duplicate node id: ${node.id}`,
                target: { type: 'node', id: node.id },
              })
            }
            // 检查新增节点内部端点 ID 冲突
            for (const input of node.inputs) {
               if (state.hasEndpoint(input.id)) {
                  diagnostics.push({
                    level: 'error',
                    code: 'identity',
                    message: `Duplicate endpoint id: ${input.id}`,
                    target: { type: 'endpoint', id: input.id },
                  })
               }
            }
            for (const output of node.outputs) {
               if (state.hasEndpoint(output.id)) {
                  diagnostics.push({
                    level: 'error',
                    code: 'identity',
                    message: `Duplicate endpoint id: ${output.id}`,
                    target: { type: 'endpoint', id: output.id },
                  })
               }
            }
          }
        }

        // 2. 检查新增边 ID 是否冲突
        if (patch.edgeAdd) {
          for (const edge of patch.edgeAdd) {
            if (state.hasEdge(edge.id)) {
              diagnostics.push({
                level: 'error',
                code: 'identity',
                message: `Duplicate edge id: ${edge.id}`,
                target: { type: 'edge', id: edge.id },
              })
            }
          }
        }
        
        return diagnostics
      }

      // 全量校验逻辑
      const nodeIdSet = new Set<string>()
      const endpointIdSet = new Set<string>()
      const edgeIdSet = new Set<string>()

      return [
        ...checkNodeIds(state, nodeIdSet),
        ...checkEndpointIds(state, endpointIdSet),
        ...checkEdgeIds(state, edgeIdSet),
      ]
    },
})

function checkNodeIds(state: GraphState, nodeIdSet: Set<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const node of state.listNodes) {
    if (nodeIdSet.has(node.id)) {
      diagnostics.push({
        level: 'error',
        code: 'identity',
        message: `Duplicate node id: ${node.id}`,
        target: { type: 'node', id: node.id },
      })
      continue
    }

    nodeIdSet.add(node.id)
  }

  return diagnostics
}

function checkEndpointIds(
  state: GraphState,
  endpointIdSet: Set<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const node of state.listNodes) {
    for (const endpoint of node.inputs) {
      diagnostics.push(
        ...checkEndpointId(endpoint.id, endpointIdSet),
      )
    }
    for (const endpoint of node.outputs) {
      diagnostics.push(
        ...checkEndpointId(endpoint.id, endpointIdSet),
      )
    }
  }

  return diagnostics
}

function checkEndpointId(
  endpointId: string,
  endpointIdSet: Set<string>,
): Diagnostic[] {
  if (!endpointIdSet.has(endpointId)) {
    endpointIdSet.add(endpointId)
    return []
  }

  return [
    {
      level: 'error',
      code: 'identity',
      message: `Duplicate endpoint id: ${endpointId}`,
      target: { type: 'endpoint', id: endpointId },
    },
  ]
}

function checkEdgeIds(state: GraphState, edgeIdSet: Set<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const edge of state.listEdges) {
    if (edgeIdSet.has(edge.id)) {
      diagnostics.push({
        level: 'error',
        code: 'identity',
        message: `Duplicate edge id: ${edge.id}`,
        target: { type: 'edge', id: edge.id },
      })
      continue
    }

    edgeIdSet.add(edge.id)
  }

  return diagnostics
}
