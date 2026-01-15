import type { SemanticPlugin } from './plugin'

/**
 * 语义插件模块来源描述。
 *
 * - string/URL：通过动态 import 加载
 * - function/object：用于非模块来源的自定义加载
 */
export type PluginSource<T = unknown, C = unknown> =
  | string
  | URL
  | (() => Promise<SemanticPlugin<T, C> | SemanticPlugin<T, C>[]>)
  | { load(): Promise<SemanticPlugin<T, C> | SemanticPlugin<T, C>[]> }

/**
 * 动态加载规则。
 */
export interface PluginRule {
  allowedPrefix?: string[]
}

function isAllowed(name: string, rule?: PluginRule): boolean {
  const prefixList = rule?.allowedPrefix
  if (!prefixList || prefixList.length === 0) return true
  return prefixList.some((prefix) => name.startsWith(prefix))
}

function toList<T, C>(value: SemanticPlugin<T, C> | SemanticPlugin<T, C>[]): SemanticPlugin<T, C>[] {
  return Array.isArray(value) ? value : [value]
}

async function importValue(source: string | URL): Promise<unknown> {
  const specifier = typeof source === 'string' ? source : source.href
  return import(specifier)
}

export async function loadPlugin<T = unknown, C = unknown>(
  source: PluginSource<T, C>,
  rule?: PluginRule,
): Promise<SemanticPlugin<T, C>[]> {
  if (typeof source === 'function') return toList(await source())
  if (typeof source === 'object' && 'load' in source) return toList(await source.load())

  const moduleName = typeof source === 'string' ? source : source.href
  if (!isAllowed(moduleName, rule)) throw new Error(`Module not allowed: ${moduleName}`)

  const moduleValue = await importValue(source)
  if (typeof moduleValue !== 'object' || !moduleValue) throw new Error(`Invalid module: ${moduleName}`)

  const anyModule = moduleValue as Record<string, unknown>
  const exported = anyModule.plugins ?? anyModule.plugin ?? anyModule.default
  if (!exported) throw new Error(`Missing export: ${moduleName}`)

  return toList(exported as SemanticPlugin<T, C> | SemanticPlugin<T, C>[])
}
