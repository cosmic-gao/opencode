import { Graph, type Edge, type Node } from '../model'
import { IncrementalLookup } from '../lookup'
import { type Diagnostic, type ValidateOptions, validate } from '../validate'
import { GraphStore, type Patch, type UndoPatch } from '../state'

/**
 * 更新结果
 */
export interface GraphResult {
  graph: Graph
  patch: Patch
  diagnostics: readonly Diagnostic[]
}

/**
 * 图编辑器 (GraphEditor)
 *
 * 该接口是 Workspace.update 的唯一写入口，用于表达意图并生成事实补丁。
 */
export interface GraphEditor {
  createNode(node: Node): void
  replaceNode(node: Node): void
  removeNode(nodeId: string): void
  createEdge(edge: Edge): void
  replaceEdge(edge: Edge): void
  removeEdge(edgeId: string): void
  applyPatch(patch: Patch): void
}

export class GraphWorkspace {
  private state: GraphStore
  private index: IncrementalLookup
  private graphSnapshot: Graph

  constructor(graph: Graph) {
    this.state = GraphStore.fromGraph(graph)
    this.index = new IncrementalLookup(this.state)
    this.graphSnapshot = graph
  }

  /**
   * 在事务中更新图，并在成功后提交为新的不可变快照。
   *
   * @param updater - 事务更新函数
   * @param options - 校验选项
   * @returns 更新结果（新图快照、事实补丁、诊断信息）
   * @throws 当 updater 抛错或校验失败时抛出错误，且状态会回滚
   *
   * @example
   * const result = workspace.update((transaction) => {
   *   transaction.createNode(new Node({ type: 'task', inputs: [], outputs: [] }))
   * })
   */
  update(updater: (editor: GraphEditor) => void, options: ValidateOptions = {}): GraphResult {
    const undoList: UndoPatch[] = []
    const patchLog = new PatchLog()
    const editor = new GraphEdit(this.state, this.index, patchLog, undoList)

    try {
      updater(editor)

      const patch = patchLog.createPatch()
      const diagnostics = validate(this.state, patch, options)
      const graph = this.state.toGraph()
      this.throwIfInvalid(diagnostics)

      this.graphSnapshot = graph

      return { graph, patch, diagnostics }
    } catch (error) {
      for (let index = undoList.length - 1; index >= 0; index--) {
        const undo = undoList[index]
        if (!undo) continue
        this.index.applyPatch(undo)
        this.state.apply(undo)
      }
      this.graphSnapshot = this.state.toGraph()
      throw error
    }
  }

  /**
   * 直接应用事实补丁（仍然在事务与校验保护下执行）。
   *
   * @param patch - 事实补丁
   * @param options - 校验选项
   * @returns 更新结果
   * @throws 当补丁应用失败或校验失败时抛出错误，且状态会回滚
   */
  applyPatch(patch: Patch, options: ValidateOptions = {}): GraphResult {
    return this.update((editor) => editor.applyPatch(patch), options)
  }

  /**
   * 获取当前不可变图快照。
   *
   * @returns 当前图快照
   */
  get graph(): Graph {
    return this.graphSnapshot
  }

  private throwIfInvalid(diagnostics: readonly Diagnostic[]): void {
    const errorList = diagnostics.filter((diagnostic) => diagnostic.level === 'error')
    if (errorList.length === 0) return
    throw new Error(`Graph validation failed: ${errorList.map((diagnostic) => diagnostic.message).join(', ')}`)
  }
}

class PatchLog {
  private readonly addedNodes: Node[] = []
  private readonly addedEdges: Edge[] = []
  private readonly removedNodeIds: Set<string> = new Set()
  private readonly removedEdgeIds: Set<string> = new Set()
  private readonly replacedNodes: Node[] = []
  private readonly replacedEdges: Edge[] = []

  addPatch(patch: Patch): void {
    if (patch.nodeAdd) this.addedNodes.push(...patch.nodeAdd)
    if (patch.edgeAdd) this.addedEdges.push(...patch.edgeAdd)
    if (patch.nodeReplace) this.replacedNodes.push(...patch.nodeReplace)
    if (patch.edgeReplace) this.replacedEdges.push(...patch.edgeReplace)
    if (patch.nodeRemove) for (const nodeId of patch.nodeRemove) this.removedNodeIds.add(nodeId)
    if (patch.edgeRemove) for (const edgeId of patch.edgeRemove) this.removedEdgeIds.add(edgeId)
  }

  createPatch(): Patch {
    return {
      nodeAdd: this.addedNodes.length > 0 ? Object.freeze([...this.addedNodes]) : undefined,
      edgeAdd: this.addedEdges.length > 0 ? Object.freeze([...this.addedEdges]) : undefined,
      nodeReplace: this.replacedNodes.length > 0 ? Object.freeze([...this.replacedNodes]) : undefined,
      edgeReplace: this.replacedEdges.length > 0 ? Object.freeze([...this.replacedEdges]) : undefined,
      nodeRemove: this.removedNodeIds.size > 0 ? Object.freeze([...this.removedNodeIds]) : undefined,
      edgeRemove: this.removedEdgeIds.size > 0 ? Object.freeze([...this.removedEdgeIds]) : undefined,
    }
  }
}

class GraphEdit implements GraphEditor {
  private readonly state: GraphStore
  private readonly index: IncrementalLookup
  private readonly patchLog: PatchLog
  private readonly undoList: UndoPatch[]

  constructor(state: GraphStore, index: IncrementalLookup, patchLog: PatchLog, undoList: UndoPatch[]) {
    this.state = state
    this.index = index
    this.patchLog = patchLog
    this.undoList = undoList
  }

  createNode(node: Node): void {
    this.applyPatch({ nodeAdd: [node] })
  }

  replaceNode(node: Node): void {
    this.applyPatch({ nodeReplace: [node] })
  }

  removeNode(nodeId: string): void {
    const edgeIds = this.collectEdges(nodeId)
    this.applyPatch({ edgeRemove: edgeIds, nodeRemove: [nodeId] })
  }

  createEdge(edge: Edge): void {
    this.applyPatch({ edgeAdd: [edge] })
  }

  replaceEdge(edge: Edge): void {
    this.applyPatch({ edgeReplace: [edge] })
  }

  removeEdge(edgeId: string): void {
    this.applyPatch({ edgeRemove: [edgeId] })
  }

  applyPatch(patch: Patch): void {
    const undo = this.state.apply(patch)
    this.index.applyPatch(patch)
    this.patchLog.addPatch(patch)
    this.undoList.push(undo)
  }

  private collectEdges(nodeId: string): string[] {
    const edgeIds: string[] = []
    for (const edge of this.state.getNodeIncoming(nodeId)) edgeIds.push(edge.id)
    for (const edge of this.state.getNodeOutgoing(nodeId)) edgeIds.push(edge.id)
    return [...new Set(edgeIds)]
  }
}
