import type { Diagnostic } from '../../../syntax/diagnostic'
import type { SyntaxNode } from '../../../syntax/node'
import { HtmlLsTokenizer } from './tokenizer'
import { HtmlLsTreeBuilder } from './tree-builder'

export interface HtmlLsParseResult {
  nodes: SyntaxNode[]
  diagnostics: Diagnostic[]
}

export class HtmlLsParser {
  parse(text: string): HtmlLsParseResult {
    const tokenizer = new HtmlLsTokenizer(text)
    const tokenized = tokenizer.tokenize()
    const builder = new HtmlLsTreeBuilder()
    return builder.build(tokenized.tokens, tokenized.diagnostics)
  }
}

