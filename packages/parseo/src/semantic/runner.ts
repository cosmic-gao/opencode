import { sort } from '@opencode/plugable'
import type { Diagnostic } from '../syntax/diagnostic'
import type { NeutralDocument } from '../neutral/document'
import type { SemanticPlugin } from './plugin'

export interface RunFilter {
  name?: string[]
  tag?: string[]
}

export interface RunResult<T = unknown> {
  value?: T
  diagnostics: Diagnostic[]
}

/**
 * 对中立文档运行语义插件。
 *
 * Runner 只负责任务编排与调度，不包含解析/建模逻辑。
 */
export class SemanticRunner<C = unknown> {
  private readonly pluginMap = new Map<string, SemanticPlugin<unknown, C>>()

  /**
   * 列出已注册的插件。
   *
   * @returns 插件列表
   */
  list(): SemanticPlugin<unknown, C>[] {
    return [...this.pluginMap.values()]
  }

  /**
   * 按名称获取插件。
   *
   * @param name - 插件名
   * @returns 插件或 undefined
   */
  get(name: string): SemanticPlugin<unknown, C> | undefined {
    return this.pluginMap.get(name)
  }

  /**
   * 按名称注册插件（后注册覆盖先注册）。
   *
   * @param plugin - 插件实例
   */
  register(plugin: SemanticPlugin<unknown, C>): void {
    this.pluginMap.set(plugin.name, plugin)
  }

  /**
   * 批量注册插件。
   *
   * @param plugins - 插件列表
   */
  registerMany(plugins: SemanticPlugin<unknown, C>[]): void {
    for (const plugin of plugins) this.register(plugin)
  }

  /**
   * 按名称运行单个插件。
   *
   * @param name - 插件名
   * @param document - 中立文档
   * @param context - 外部执行上下文
   * @returns 运行结果（不抛异常，错误以 diagnostics 返回）
   */
  async run(name: string, document: NeutralDocument, context: C): Promise<RunResult> {
    const diagnostics: Diagnostic[] = []
    const plugin = this.pluginMap.get(name)
    if (!plugin) return { diagnostics: [{ level: 'error', code: 'semantic', message: `Missing semantic: ${name}` }] }
    if (!plugin.supports(document)) {
      return { diagnostics: [{ level: 'error', code: 'semantic', message: `Unsupported semantic: ${name}` }] }
    }

    try {
      await plugin.prepare?.(document, context)
      const value = await plugin.run(document, context)
      return { value, diagnostics }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      diagnostics.push({ level: 'error', code: 'semantic', message })
      return { diagnostics }
    }
  }

  /**
   * 运行单个插件，并将 unknown 结果映射为强类型值。
   *
   * @param name - 插件名
   * @param document - 中立文档
   * @param context - 外部执行上下文
   * @param mapValue - 结果值转换器（用于边界校验与类型收敛）
   * @returns 强类型运行结果
   */
  async runWith<T>(
    name: string,
    document: NeutralDocument,
    context: C,
    mapValue: (value: unknown) => T,
  ): Promise<RunResult<T>> {
    const result = await this.run(name, document, context)
    if (result.diagnostics.length) return { diagnostics: result.diagnostics }
    if (result.value === undefined) return { diagnostics: result.diagnostics }
    try {
      return { value: mapValue(result.value), diagnostics: result.diagnostics }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { diagnostics: [{ level: 'error', code: 'semantic', message }] }
    }
  }

  /**
   * 按依赖顺序运行一组插件。
   *
   * @param document - 中立文档
   * @param context - 外部执行上下文
   * @param filter - 可选过滤条件
   * @returns 以插件名为 key 的结果表
   */
  async runAll(document: NeutralDocument, context: C, filter?: RunFilter): Promise<Map<string, RunResult>> {
    const pluginList = this.selectPlugins(document, filter)
    const sortedList = this.sortPlugins(pluginList)

    const resultMap = new Map<string, RunResult>()
    for (const plugin of sortedList) {
      const result = await this.run(plugin.name, document, context)
      resultMap.set(plugin.name, result)
    }
    return resultMap
  }

  private selectPlugins(document: NeutralDocument, filter?: RunFilter): SemanticPlugin<unknown, C>[] {
    const pluginList = this.list().filter((plugin) => plugin.supports(document))
    if (!filter) return pluginList

    let nextList = pluginList
    if (filter.name?.length) {
      const nameSet = new Set(filter.name)
      nextList = nextList.filter((plugin) => nameSet.has(plugin.name))
    }
    if (filter.tag?.length) {
      const tagSet = new Set(filter.tag)
      const tags = new Set(document.tags ?? [])
      const hasAny = [...tagSet].some((tag) => tags.has(tag))
      if (!hasAny) return []
    }
    return nextList
  }

  private sortPlugins(plugins: SemanticPlugin<unknown, C>[]): SemanticPlugin<unknown, C>[] {
    const sorted = sort(
      plugins.map((plugin) => ({
        name: plugin.name,
        required: plugin.required,
        pre: plugin.before,
        post: plugin.after,
        setup: () => {},
      })),
    ).sorted

    const map = new Map(plugins.map((plugin) => [plugin.name, plugin] as const))
    return sorted.map((pluginInfo) => map.get(pluginInfo.name)!).filter(Boolean)
  }
}
