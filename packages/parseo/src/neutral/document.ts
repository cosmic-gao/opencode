import type { SourceSpan } from '../syntax/diagnostic'
import type { MetaStore } from '../syntax/node'
import type { NeutralEntity, NeutralLink } from './entity'

export interface NeutralDocument {
  entities: NeutralEntity[]
  links: NeutralLink[]
  span?: SourceSpan
  meta?: MetaStore
  tags?: string[]
}

/**
 * 创建一个空的中立文档。
 *
 * @returns 中立文档
 */
export function createDocument(): NeutralDocument {
  return { entities: [], links: [] }
}
