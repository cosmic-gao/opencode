import { type Edge, Graph, Mutable, type Node, type Patch, Store, type UndoPatch } from '../core';
import { type Diagnostic, type ValidateOptions, Validator } from '../features';

/**
 * 更新结果
 * 包含更新后的图快照、本次操作的 Patch 以及校验诊断信息。
 */
export interface Result {
  /** 更新后的图快照（不可变） */
  graph: Graph;
  /** 本次操作产生的事实补丁 */
  patch: Patch;
  /** 校验产生的诊断信息 */
  diagnostics: readonly Diagnostic[];
}

/**
 * 图编辑器 (Editor)
 *
 * 该接口是 Workspace.update 的唯一写入口，用于表达意图并生成事实补丁。
 * 它提供了一组高级语义的操作方法（如 createNode），并自动处理依赖关系（如删除节点时自动删除连接的边）。
 */
export interface Editor {
  /**
   * 创建新节点。
   * @param node - 节点对象
   */
  createNode(node: Node): void;

  /**
   * 替换现有节点。
   * @param node - 新节点对象
   */
  replaceNode(node: Node): void;

  /**
   * 移除节点（及其关联的边）。
   * @param nodeId - 节点 ID
   */
  removeNode(nodeId: string): void;

  /**
   * 创建新边。
   * @param edge - 边对象
   */
  createEdge(edge: Edge): void;

  /**
   * 替换现有边。
   * @param edge - 新边对象
   */
  replaceEdge(edge: Edge): void;

  /**
   * 移除边。
   * @param edgeId - 边 ID
   */
  removeEdge(edgeId: string): void;

  /**
   * 直接应用底层事实补丁。
   * @param patch - 事实补丁
   */
  apply(patch: Patch): void;
}

/**
 * 图工作区 (Workspace)
 *
 * 工作区是图编辑的核心容器，负责协调状态管理、增量索引和实时校验。
 * 它维护一个当前的图状态，并提供事务性的更新接口。
 *
 * 主要特性：
 * - **事务性更新**：通过 update 方法提供原子性的更新操作，失败自动回滚。
 * - **实时校验**：每次更新后自动运行增量校验，确保数据一致性。
 * - **快照管理**：每次更新成功后生成新的不可变 Graph 快照。
 * - **增量索引**：内部维护 IncrementalLookup，提供高性能查询。
 */
export class Workspace {
  private state: Store;
  private index: Mutable;
  private graphSnapshot: Graph;

  /**
   * 创建工作区实例。
   *
   * @param graph - 初始图快照
   */
  constructor(graph: Graph) {
    this.state = Store.from(graph);
    this.index = new Mutable(this.state);
    this.graphSnapshot = graph;
  }

  /**
   * 在事务中更新图，并在成功后提交为新的不可变快照。
   *
   * @param updater - 事务更新函数，接收一个 Editor 实例用于执行操作
   * @param options - 校验选项
   * @returns 更新结果（新图快照、事实补丁、诊断信息）
   * @throws {Error} 当 updater 抛错或校验失败（存在 error 级别的诊断）时抛出错误，且状态会回滚
   *
   * @example
   * const result = workspace.update((editor) => {
   *   editor.createNode(newNode);
   *   editor.createEdge(newEdge);
   * });
   */
  update(updater: (editor: Editor) => void, options: ValidateOptions = {}): Result {
    const undoList: UndoPatch[] = [];
    const patchLog = new PatchLog();
    const editor = new Edit(this.state, this.index, patchLog, undoList);

    try {
      updater(editor);

      const patch = patchLog.createPatch();
      const diagnostics = Validator.check(this.state, patch, options);
      const graph = this.state.toGraph();
      this.assert(diagnostics);

      this.graphSnapshot = graph;

      return { graph, patch, diagnostics };
    } catch (error) {
      // 回滚操作
      for (let index = undoList.length - 1; index >= 0; index--) {
        const undo = undoList[index];
        if (!undo) continue;
        this.index.applyPatch(undo);
        this.state.apply(undo);
      }
      // 恢复快照引用（虽然 state 已回滚，但为了保险起见重新生成）
      this.graphSnapshot = this.state.toGraph();
      throw error;
    }
  }

  /**
   * 直接应用事实补丁（仍然在事务与校验保护下执行）。
   *
   * @param patch - 事实补丁
   * @param options - 校验选项
   * @returns 更新结果
   * @throws {Error} 当补丁应用失败或校验失败时抛出错误，且状态会回滚
   */
  apply(patch: Patch, options: ValidateOptions = {}): Result {
    return this.update((editor) => editor.apply(patch), options);
  }

  /**
   * 获取当前不可变图快照。
   *
   * @returns 当前图快照
   */
  get graph(): Graph {
    return this.graphSnapshot;
  }

  private assert(diagnostics: readonly Diagnostic[]): void {
    const errorList = diagnostics.filter((diagnostic) => diagnostic.level === 'error');
    if (errorList.length === 0) return;
    throw new Error(
      `Graph validation failed: ${errorList.map((diagnostic) => diagnostic.message).join(', ')}`,
    );
  }
}

class PatchLog {
  private readonly addedNodes: Node[] = [];
  private readonly addedEdges: Edge[] = [];
  private readonly removedNodeIds: Set<string> = new Set();
  private readonly removedEdgeIds: Set<string> = new Set();
  private readonly replacedNodes: Node[] = [];
  private readonly replacedEdges: Edge[] = [];

  addPatch(patch: Patch): void {
    if (patch.nodeAdd) this.addedNodes.push(...patch.nodeAdd);
    if (patch.edgeAdd) this.addedEdges.push(...patch.edgeAdd);
    if (patch.nodeReplace) this.replacedNodes.push(...patch.nodeReplace);
    if (patch.edgeReplace) this.replacedEdges.push(...patch.edgeReplace);
    if (patch.nodeRemove) { for (const nodeId of patch.nodeRemove) {
        this.removedNodeIds.add(nodeId);
      } }
    if (patch.edgeRemove) { for (const edgeId of patch.edgeRemove) {
        this.removedEdgeIds.add(edgeId);
      } }
  }

  createPatch(): Patch {
    return {
      nodeAdd: this.addedNodes.length > 0 ? Object.freeze([...this.addedNodes]) : undefined,
      edgeAdd: this.addedEdges.length > 0 ? Object.freeze([...this.addedEdges]) : undefined,
      nodeReplace: this.replacedNodes.length > 0
        ? Object.freeze([...this.replacedNodes])
        : undefined,
      edgeReplace: this.replacedEdges.length > 0
        ? Object.freeze([...this.replacedEdges])
        : undefined,
      nodeRemove: this.removedNodeIds.size > 0
        ? Object.freeze([...this.removedNodeIds])
        : undefined,
      edgeRemove: this.removedEdgeIds.size > 0
        ? Object.freeze([...this.removedEdgeIds])
        : undefined,
    };
  }
}

class Edit implements Editor {
  private readonly state: Store;
  private readonly index: Mutable;
  private readonly patchLog: PatchLog;
  private readonly undoList: UndoPatch[];

  constructor(state: Store, index: Mutable, patchLog: PatchLog, undoList: UndoPatch[]) {
    this.state = state;
    this.index = index;
    this.patchLog = patchLog;
    this.undoList = undoList;
  }

  createNode(node: Node): void {
    this.apply({ nodeAdd: [node] });
  }

  replaceNode(node: Node): void {
    this.apply({ nodeReplace: [node] });
  }

  removeNode(nodeId: string): void {
    // 自动收集并删除关联的边
    const edgeIds = this.collectEdges(nodeId);
    this.apply({ edgeRemove: edgeIds, nodeRemove: [nodeId] });
  }

  createEdge(edge: Edge): void {
    this.apply({ edgeAdd: [edge] });
  }

  replaceEdge(edge: Edge): void {
    this.apply({ edgeReplace: [edge] });
  }

  removeEdge(edgeId: string): void {
    this.apply({ edgeRemove: [edgeId] });
  }

  apply(patch: Patch): void {
    const undo = this.state.apply(patch);
    this.index.applyPatch(patch);
    this.patchLog.addPatch(patch);
    this.undoList.push(undo);
  }

  private collectEdges(nodeId: string): string[] {
    const edgeIds: string[] = [];
    for (const edge of this.state.incoming(nodeId)) edgeIds.push(edge.id);
    for (const edge of this.state.outgoing(nodeId)) edgeIds.push(edge.id);
    return [...new Set(edgeIds)];
  }
}
