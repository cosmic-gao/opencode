import type { Edge, Patch } from '../../../core'
import type { Diagnostic, GraphState, Rule, ValidateOptions } from '..'

/**
 * 基数校验规则 (Cardinality)
 *
 * 检查输入端点的连接数限制。
 * 默认情况下，一个输入端点最多只能连接一条边（Fan-in = 1）。
 * 如果 options.allowMultiple 为 true，则解除此限制。
 *
 * @param options - 校验选项
 * @returns 校验规则实例
 */
export const cardinalityRule = (options: ValidateOptions): Rule => {
  const allowMultiple = options.allowMultiple === true;

  return {
    name: 'cardinality',
    evaluate(state, patch) {
      if (allowMultiple) return [];

      // 确定需要检查的输入端点列表
      // 如果有 Patch，只检查受影响的端点；否则检查所有端点
      const inputIds = patch
        ? listInputs(state, patch)
        : Array.from(state.listNodes).flatMap((node) => node.inputs.map((input) => input.id));
      const diagnostics: Diagnostic[] = [];

      for (const inputId of inputIds) {
        const incoming = getIncomingEdges(state, patch, inputId);
        if (incoming.length > 1) {
          diagnostics.push({
            level: 'error',
            code: 'cardinality',
            message: `Input endpoint has multiple incoming edges: ${inputId}`,
            target: { type: 'endpoint', id: inputId },
          });
        }
      }
      return diagnostics;
    },
  };
}

/**
 * 获取指定输入端点的入边列表。
 * 支持在 Patch 上下文中计算（即考虑了 Patch 中新增、移除和替换的边）。
 *
 * @param state - 图状态
 * @param patch - 事实补丁（可选）
 * @param inputId - 输入端点 ID
 * @returns 边列表
 */
function getIncomingEdges(state: GraphState, patch: Patch | undefined, inputId: string): Edge[] {
  if (!patch) return [...state.inputEdges(inputId)];

  const edges = new Map<string, Edge>();

  // 1. 加载现有边
  for (const edge of state.inputEdges(inputId)) {
    edges.set(edge.id, edge);
  }

  // 2. 应用移除操作
  if (patch.edgeRemove) {
    for (const id of patch.edgeRemove) edges.delete(id);
  }

  // 3. 应用替换和添加操作
  const processEdge = (edge: Edge) => {
    if (edge.target.endpointId === inputId) {
      // 如果新边指向当前输入端点，加入集合
      edges.set(edge.id, edge);
    } else if (edges.has(edge.id)) {
      // 如果边存在于集合中（原先指向此端点），但现在指向别处（或被替换），
      // 则需要从当前端点的入边集合中移除。
      // 注意：如果是替换且目标端点没变，上面的 if 分支会处理更新。
      edges.delete(edge.id);
    }
  };

  if (patch.edgeReplace) { for (const edge of patch.edgeReplace) processEdge(edge); }
  if (patch.edgeAdd) { for (const edge of patch.edgeAdd) processEdge(edge); }

  return [...edges.values()];
}

/**
 * 列出受 Patch 影响的所有输入端点 ID。
 * 用于增量校验时的范围优化。
 *
 * @param state - 图状态
 * @param patch - 事实补丁
 * @returns 输入端点 ID 列表
 */
function listInputs(state: GraphState, patch: Patch): readonly string[] {
  const inputIdSet = new Set<string>();

  // 检查新增和替换的边，其目标端点受影响
  for (const edge of patch.edgeAdd ?? []) inputIdSet.add(edge.target.endpointId);
  for (const edge of patch.edgeReplace ?? []) inputIdSet.add(edge.target.endpointId);

  // 检查替换的节点，其所有输入端点受影响（可能属性变更）
  for (const node of patch.nodeReplace ?? []) {
    const current = state.getNode(node.id);
    if (!current) continue;
    for (const input of current.inputs) inputIdSet.add(input.id);
  }

  // 检查新增的节点，其所有输入端点受影响
  for (const node of patch.nodeAdd ?? []) {
    for (const input of node.inputs) inputIdSet.add(input.id);
  }

  // 注意：移除的边不需要检查，因为移除边只会减少连接数，不会违反 "最多一个" 的规则（除非规则变了，但此处只考虑 cardinality）
  // 严谨起见，如果规则是 "必须有一个"，则移除也需要检查。但 cardinality 是 "最多一个"。

  return [...inputIdSet];
}
