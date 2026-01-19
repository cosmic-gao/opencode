import type { Edge, Node } from '../model'

/**
 * 图事实变更 (Patch)
 *
 * Patch 描述了对图数据状态的原子变更操作。
 * 它包含一组可选的添加、移除或替换指令。
 *
 * 主要特性：
 * - **原子性**：一个 Patch 中的所有操作应当作为一个整体应用，要么全部成功，要么全部失败（如果发生错误）。
 * - **事实层**：Patch 仅描述数据的变化（Fact），不包含业务意图（Intent）。
 */
export interface Patch {
  /** 要添加的新节点列表 */
  nodeAdd?: readonly Node[]
  /** 要添加的新边列表 */
  edgeAdd?: readonly Edge[]
  /** 要移除的节点 ID 列表 */
  nodeRemove?: readonly string[]
  /** 要移除的边 ID 列表 */
  edgeRemove?: readonly string[]
  /** 要替换的节点列表（ID 必须存在） */
  nodeReplace?: readonly Node[]
  /** 要替换的边列表（ID 必须存在） */
  edgeReplace?: readonly Edge[]
}

/**
 * 回滚补丁 (UndoPatch)
 *
 * UndoPatch 本质上也是一个 Patch，但它的目的是为了撤销前一个 Patch 产生的效果。
 * 通常由 Store.apply 方法自动生成。
 *
 * @example
 * const patch = { nodeAdd: [node] };
 * const undo = store.apply(patch);
 * // undo 将包含 { nodeRemove: [node.id] }
 * store.apply(undo); // 恢复原状
 */
export interface UndoPatch extends Patch {}
