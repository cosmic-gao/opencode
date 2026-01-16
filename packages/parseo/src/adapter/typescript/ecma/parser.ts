import type { Diagnostic } from '../../../syntax/diagnostic'
import type { SyntaxNode } from '../../../syntax/node'
import { EcmaParser } from '../../javascript/ecma/parser'

export interface TsParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

export class TypescriptParser {
  parse(text: string): TsParseResult {
    const parser = new EcmaParser()
    return parser.parse(text)
  }
}
