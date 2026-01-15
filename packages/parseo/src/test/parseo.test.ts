import { describe, expect, test } from 'bun:test'
import { FlowBuilder, SemanticRunner, codeGenPlugin, createDocument, loadBuilder, loadPlugin, parseText, stateMachinePlugin, validationPlugin } from '..'

describe('parseo', () => {
  test('parses and runs built-in flow semantics', async () => {
    const text = `
flow OrderFlow {
  node Create
  node Pay
  edge Create -> Pay
}
`

    const parseResult = parseText(text)
    expect(parseResult.diagnostics.length).toBe(0)

    const document = createDocument()
    const builder = new FlowBuilder()
    const context = { diagnostics: [] }
    for (const node of parseResult.nodes) {
      if (builder.supports(node)) builder.build(node, document, context)
    }

    const runner = new SemanticRunner()
    runner.registerMany([validationPlugin, stateMachinePlugin, codeGenPlugin])

    const validationResult = await runner.run('validation', document, undefined)
    expect(validationResult.diagnostics.length).toBe(0)

    const stateResult = await runner.runWith('state-machine', document, undefined, (value) => {
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Invalid result')
      return value
    })
    expect(stateResult.value).toEqual(['Create', 'Pay'])

    const codeResult = await runner.runWith('codegen', document, undefined, (value) => {
      if (typeof value !== 'string') throw new Error('Invalid result')
      return value
    })
    expect(codeResult.value?.includes('export class OrderFlowFlow')).toBe(true)
  })

  test('loads semantic plugin module dynamically', async () => {
    const moduleUrl = new URL('./plugin-module.ts', import.meta.url)
    const plugins = await loadPlugin(moduleUrl, { allowedPrefix: ['file:'] })
    expect(plugins[0]?.name).toBe('plugin-module')

    const runner = new SemanticRunner()
    runner.registerMany(plugins)
    const result = await runner.runWith('plugin-module', createDocument(), undefined, (value) => {
      if (typeof value !== 'string') throw new Error('Invalid result')
      return value
    })
    expect(result.value).toBe('ok')
  })

  test('loads model builder module dynamically', async () => {
    const moduleUrl = new URL('./builder-module.ts', import.meta.url)
    const builders = await loadBuilder(moduleUrl, { allowedPrefix: ['file:'] })
    expect(builders[0]?.name).toBe('builder-module')
  })
})
