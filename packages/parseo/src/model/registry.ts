import type { ModelBuilder } from './builder'

/**
 * 以名称存储模型构建器。
 */
export class BuilderRegistry {
  private readonly builderMap = new Map<string, ModelBuilder>()

  /**
   * 列出已注册的构建器。
   *
   * @returns 构建器列表
   */
  list(): ModelBuilder[] {
    return [...this.builderMap.values()]
  }

  /**
   * 按名称获取构建器。
   *
   * @param name - 构建器名
   * @returns 构建器或 undefined
   */
  get(name: string): ModelBuilder | undefined {
    return this.builderMap.get(name)
  }

  /**
   * 按名称注册构建器（后注册覆盖先注册）。
   *
   * @param builder - 构建器实例
   */
  register(builder: ModelBuilder): void {
    this.builderMap.set(builder.name, builder)
  }
}
