import type { Edge, Node } from '../model'

/**
 * 图事实变更 (Patch)
 *
 * Patch 只描述“事实层”变更：新增、移除、替换。
 * 它不表达意图（意图由更高层的 Command/Transaction 方法表达）。
 */
export interface Patch {
  nodeAdd?: readonly Node[]
  edgeAdd?: readonly Edge[]
  nodeRemove?: readonly string[]
  edgeRemove?: readonly string[]
  nodeReplace?: readonly Node[]
  edgeReplace?: readonly Edge[]
}

/**
 * 回滚补丁 (UndoPatch)
 *
 * UndoPatch 与 Patch 同结构，但语义是“撤销之前的变更”。
 * @example
 * const undo = store.apply(patch)
 * store.apply(undo)
 */
export interface UndoPatch extends Patch {}
