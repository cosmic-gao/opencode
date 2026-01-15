import type { ModelBuilder } from './builder'

/**
 * 构建器模块来源描述。
 *
 * - string/URL：通过动态 import 加载
 * - function/object：用于非模块来源的自定义加载
 */
export type BuilderSource =
  | string
  | URL
  | (() => Promise<ModelBuilder | ModelBuilder[]>)
  | { load(): Promise<ModelBuilder | ModelBuilder[]> }

/**
 * 动态加载规则。
 */
export interface BuilderRule {
  allowedPrefix?: string[]
}

function isAllowed(name: string, rule?: BuilderRule): boolean {
  const prefixList = rule?.allowedPrefix
  if (!prefixList || prefixList.length === 0) return true
  return prefixList.some((prefix) => name.startsWith(prefix))
}

function toList(value: ModelBuilder | ModelBuilder[]): ModelBuilder[] {
  return Array.isArray(value) ? value : [value]
}

async function importValue(source: string | URL): Promise<unknown> {
  const specifier = typeof source === 'string' ? source : source.href
  return import(specifier)
}

export async function loadBuilder(source: BuilderSource, rule?: BuilderRule): Promise<ModelBuilder[]> {
  if (typeof source === 'function') return toList(await source())
  if (typeof source === 'object' && 'load' in source) return toList(await source.load())

  const moduleName = typeof source === 'string' ? source : source.href
  if (!isAllowed(moduleName, rule)) throw new Error(`Module not allowed: ${moduleName}`)

  const moduleValue = await importValue(source)
  if (typeof moduleValue !== 'object' || !moduleValue) throw new Error(`Invalid module: ${moduleName}`)

  const anyModule = moduleValue as Record<string, unknown>
  const exported = anyModule.builders ?? anyModule.builder ?? anyModule.default
  if (!exported) throw new Error(`Missing export: ${moduleName}`)

  return toList(exported as ModelBuilder | ModelBuilder[])
}
