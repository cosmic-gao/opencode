import type { SourceSpan } from '../syntax/diagnostic'
import type { MetaStore, MetaValue } from '../syntax/node'

export interface Reference {
  type?: string
  name: string
}

export interface NeutralEntity {
  type: string
  name: string
  attrs?: Record<string, MetaValue>
  span?: SourceSpan
  meta?: MetaStore
  tags?: string[]
}

export interface NeutralLink {
  type: string
  from: Reference
  to: Reference
  attrs?: Record<string, MetaValue>
  span?: SourceSpan
  meta?: MetaStore
  tags?: string[]
}

/**
 * 命名空间化的 meta 访问器。
 *
 * 约定使用插件名/构建器名作为 ownerName，避免不同扩展产生 key 冲突。
 */
export class MetaManager {
  private readonly store: MetaStore

  /**
   * 创建 meta 管理器。
   *
   * @param store - 可选的既有存储
   */
  constructor(store?: MetaStore) {
    this.store = store ?? {}
  }

  /**
   * 在命名空间内写入 meta 值。
   *
   * @param ownerName - 命名空间 owner（插件名/构建器名）
   * @param key - meta 键
   * @param value - meta 值
   */
  set(ownerName: string, key: string, value: MetaValue): void {
    const owner = (this.store[ownerName] ??= {})
    owner[key] = value
  }

  /**
   * 从命名空间读取 meta 值。
   *
   * @param ownerName - 命名空间 owner
   * @param key - meta 键
   * @returns meta 值或 undefined
   */
  get(ownerName: string, key: string): MetaValue | undefined {
    return this.store[ownerName]?.[key]
  }

  /**
   * 列出命名空间下的全部 meta 条目。
   *
   * @param ownerName - 命名空间 owner
   * @returns meta 映射（不存在时返回空对象）
   */
  list(ownerName: string): Record<string, MetaValue> {
    return this.store[ownerName] ?? {}
  }

  /**
   * 获取底层 meta 存储。
   *
   * @returns meta 存储
   */
  value(): MetaStore {
    return this.store
  }
}
