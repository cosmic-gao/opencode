import type { NeutralDocument } from '../neutral/document'
import type { SemanticPlugin } from '../semantic/plugin'
import { linkDocument } from '../model/linker'

function findFlowName(document: NeutralDocument): string {
  return document.entities.find((entity) => entity.type === 'flow')?.name ?? 'Flow'
}

function listNodes(document: NeutralDocument): string[] {
  return document.entities.filter((entity) => entity.type === 'node').map((entity) => entity.name)
}

function listEdges(document: NeutralDocument): Array<{ from: string; to: string }> {
  return document.links.filter((link) => link.type === 'edge').map((link) => ({ from: link.from.name, to: link.to.name }))
}

export const validationPlugin: SemanticPlugin<void, unknown> = {
  name: 'validation',
  supports: (document) => document.entities.some((entity) => entity.type === 'flow'),
  run: (document) => {
    const result = linkDocument(document)
    if (result.diagnostics.length) {
      const message = result.diagnostics.map((d) => d.message).join('; ')
      throw new Error(message)
    }
  },
}

/**
 * 将 edge 解释为简单的顺序状态机（演示插件）。
 */
export const stateMachinePlugin: SemanticPlugin<string[], unknown> = {
  name: 'state-machine',
  after: ['validation'],
  supports: (document) => document.entities.some((entity) => entity.type === 'flow'),
  run: (document) => {
    const nodes = listNodes(document)
    const edges = listEdges(document)
    const nextMap = new Map(edges.map((e) => [e.from, e.to] as const))

    const sequence: string[] = []
    let current = nodes[0]
    while (current && !sequence.includes(current)) {
      sequence.push(current)
      current = nextMap.get(current) ?? ''
    }
    return sequence
  },
}

/**
 * 为 flow 文档生成 TypeScript 骨架（演示插件）。
 */
export const codeGenPlugin: SemanticPlugin<string, unknown> = {
  name: 'codegen',
  after: ['validation'],
  supports: (document) => document.entities.some((entity) => entity.type === 'flow'),
  run: (document) => {
    const flowName = findFlowName(document)
    const nodes = listNodes(document)
    const edges = listEdges(document)
    const stepList = nodes.map((n) => JSON.stringify(n)).join(', ')
    const edgeList = edges.map((e) => `{ from: ${JSON.stringify(e.from)}, to: ${JSON.stringify(e.to)} }`).join(', ')

    return [
      `export class ${flowName}Flow {`,
      `  readonly nodes = [${stepList}] as const`,
      `  readonly edges = [${edgeList}] as const`,
      `  start() {`,
      `    return this.nodes[0]`,
      `  }`,
      `}`,
      ``,
    ].join('\n')
  },
}
