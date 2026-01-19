import { type Edge, Node } from '../model'
import type { Patch, UndoPatch } from './patch'
import type { Registry } from './registry'

/**
 * 补丁应用器 (Applier)
 *
 * 负责将 Patch 应用到 Registry 中，并生成对应的 UndoPatch。
 * 它是 Store.apply 方法的具体实现者。
 *
 * 主要职责：
 * 1. 验证 Patch 的合法性（ID 冲突检查、引用检查）。
 * 2. 生成回滚操作 (UndoPatch)。
 * 3. 执行变更（更新 Registry）。
 */
export class Applier {
  constructor(private readonly registry: Registry) {}

  /**
   * 应用事实补丁，并返回回滚补丁。
   *
   * @param patch - 事实补丁
   * @returns 回滚补丁
   * @throws {Error} 当补丁存在 ID 冲突或引用缺失时抛出错误
   */
  apply(patch: Patch): UndoPatch {
    this.assert(patch)

    const undo: UndoPatch = {}

    if (patch.nodeReplace) undo.nodeReplace = this.invertNodes(patch.nodeReplace)
    if (patch.edgeReplace) undo.edgeReplace = this.invertEdges(patch.edgeReplace)
    if (patch.edgeRemove) undo.edgeAdd = this.invertEdgeRemove(patch.edgeRemove)
    if (patch.nodeRemove) undo.nodeAdd = this.invertNodeRemove(patch.nodeRemove)
    if (patch.nodeAdd) undo.nodeRemove = patch.nodeAdd.map((node) => node.id)
    if (patch.edgeAdd) undo.edgeRemove = patch.edgeAdd.map((edge) => edge.id)

    this.replaceNodes(patch.nodeReplace)
    this.replaceEdges(patch.edgeReplace)
    this.removeEdges(patch.edgeRemove)
    this.removeNodes(patch.nodeRemove)
    this.addNodes(patch.nodeAdd)
    this.addEdges(patch.edgeAdd)

    return undo
  }

  /**
   * 验证补丁的合法性。
   * 检查是否存在重复 ID 或冲突操作。
   *
   * @param patch - 待验证的补丁
   * @throws {Error} 当检测到冲突时抛出错误
   */
  private assert(patch: Patch): void {
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()

    this.track(nodeIds, patch.nodeAdd?.map((node) => node.id))
    this.track(nodeIds, patch.nodeRemove)
    this.track(nodeIds, patch.nodeReplace?.map((node) => node.id))
    this.track(edgeIds, patch.edgeAdd?.map((edge) => edge.id))
    this.track(edgeIds, patch.edgeRemove)
    this.track(edgeIds, patch.edgeReplace?.map((edge) => edge.id))
  }

  /**
   * 追踪 ID 使用情况，检测冲突。
   *
   * @param target - ID 集合
   * @param ids - 待检查的 ID 列表
   */
  private track(target: Set<string>, ids: readonly string[] | undefined): void {
    if (!ids) return
    for (const id of ids) {
      if (target.has(id)) throw new Error(`Conflicting patch id: ${id}`)
      target.add(id)
    }
  }

  /**
   * 生成节点替换的反向操作（获取旧节点）。
   *
   * @param nodes - 新节点列表
   * @returns 旧节点列表
   */
  private invertNodes(nodes: readonly Node[]): readonly Node[] {
    const next: Node[] = []
    for (const node of nodes) {
      const prev = this.registry.getNode(node.id)
      if (!prev) throw new Error(`Missing node id for replace: ${node.id}`)
      next.push(prev)
    }
    return Object.freeze(next)
  }

  /**
   * 生成边替换的反向操作（获取旧边）。
   *
   * @param edges - 新边列表
   * @returns 旧边列表
   */
  private invertEdges(edges: readonly Edge[]): readonly Edge[] {
    const next: Edge[] = []
    for (const edge of edges) {
      const prev = this.registry.getEdge(edge.id)
      if (!prev) throw new Error(`Missing edge id for replace: ${edge.id}`)
      next.push(prev)
    }
    return Object.freeze(next)
  }

  /**
   * 生成边移除的反向操作（获取被移除的边）。
   *
   * @param edgeIds - 被移除的边 ID 列表
   * @returns 被移除的边对象列表
   */
  private invertEdgeRemove(edgeIds: readonly string[]): readonly Edge[] {
    const next: Edge[] = []
    for (const edgeId of edgeIds) {
      const edge = this.registry.getEdge(edgeId)
      if (!edge) throw new Error(`Missing edge id for remove: ${edgeId}`)
      next.push(edge)
    }
    return Object.freeze(next)
  }

  /**
   * 生成节点移除的反向操作（获取被移除的节点）。
   *
   * @param nodeIds - 被移除的节点 ID 列表
   * @returns 被移除的节点对象列表
   */
  private invertNodeRemove(nodeIds: readonly string[]): readonly Node[] {
    const next: Node[] = []
    for (const nodeId of nodeIds) {
      const node = this.registry.getNode(nodeId)
      if (!node) throw new Error(`Missing node id for remove: ${nodeId}`)
      next.push(node)
    }
    return Object.freeze(next)
  }

  /**
   * 执行节点替换。
   */
  private replaceNodes(nodes: readonly Node[] | undefined): void {
    if (!nodes) return
    for (const node of nodes) this.registry.replaceNode(node)
  }

  /**
   * 执行边替换。
   */
  private replaceEdges(edges: readonly Edge[] | undefined): void {
    if (!edges) return
    for (const edge of edges) this.registry.replaceEdge(edge)
  }

  /**
   * 执行边移除。
   */
  private removeEdges(edgeIds: readonly string[] | undefined): void {
    if (!edgeIds) return
    for (const edgeId of edgeIds) this.registry.removeEdge(edgeId)
  }

  /**
   * 执行节点移除。
   */
  private removeNodes(nodeIds: readonly string[] | undefined): void {
    if (!nodeIds) return
    for (const nodeId of nodeIds) this.registry.removeNode(nodeId)
  }

  /**
   * 执行节点添加。
   */
  private addNodes(nodes: readonly Node[] | undefined): void {
    if (!nodes) return
    for (const node of nodes) this.registry.addNode(node)
  }

  /**
   * 执行边添加。
   */
  private addEdges(edges: readonly Edge[] | undefined): void {
    if (!edges) return
    for (const edge of edges) this.registry.addEdge(edge)
  }
}
