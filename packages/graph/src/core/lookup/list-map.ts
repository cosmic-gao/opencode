/**
 * 列表管理工具
 *
 * 用于抽象和封装 Map<string, T[]> 类型的常见操作。
 *
 * @internal
 */
export class ListMap<T> {
  private readonly map: Map<string, T[]>

  constructor(map?: Map<string, T[]>) {
    this.map = map ?? new Map()
  }

  /**
   * 获取指定 key 的列表。
   * 如果列表不存在，则创建一个新列表并存入 Map。
   *
   * @param key - 键
   * @returns 列表
   */
  ensure(key: string): T[] {
    let list = this.map.get(key)
    if (!list) {
      list = []
      this.map.set(key, list)
    }
    return list
  }

  /**
   * 获取指定 key 的列表（只读）。
   * 如果列表不存在，返回 undefined。
   *
   * @param key - 键
   * @returns 列表或 undefined
   */
  get(key: string): readonly T[] | undefined {
    return this.map.get(key)
  }

  /**
   * 从指定 key 的列表中移除元素。
   * 使用 swap-and-pop 优化移除性能。
   *
   * @param key - 键
   * @param value - 要移除的元素
   */
  remove(key: string, value: T): void {
    const list = this.map.get(key)
    if (!list || list.length === 0) return

    const index = list.indexOf(value)
    if (index < 0) return

    const lastIndex = list.length - 1
    const lastValue = list[lastIndex]
    
    // 如果不是最后一个元素，将最后一个元素移动到要删除的位置
    if (index !== lastIndex && lastValue !== undefined) {
      list[index] = lastValue
    }
    
    // 移除最后一个元素
    list.pop()
  }

  /**
   * 清空所有列表
   */
  clear(): void {
    this.map.clear()
  }

  /**
   * 获取内部 Map 实例
   */
  get innerMap(): Map<string, T[]> {
    return this.map
  }
}
