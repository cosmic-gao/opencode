import {
  FlowBuilder,
  SemanticRunner,
  codeGenPlugin,
  createDocument,
  parseText,
  stateMachinePlugin,
  validationPlugin,
} from './index'

const text = `
flow OrderFlow {
  node Create
  node Pay
  node Ship

  edge Create -> Pay
  edge Pay -> Ship
}
`

const parseResult = parseText(text)
if (parseResult.diagnostics.length) {
  console.log(parseResult.diagnostics)
  process.exit(1)
}

const document = createDocument()
const builder = new FlowBuilder()
const context = { diagnostics: [] }
for (const node of parseResult.nodes) {
  if (builder.supports(node)) builder.build(node, document, context)
}

const runner = new SemanticRunner()
runner.registerMany([validationPlugin, stateMachinePlugin, codeGenPlugin])

const validationResult = await runner.run('validation', document, undefined)
if (validationResult.diagnostics.length) {
  console.log(validationResult.diagnostics)
  process.exit(1)
}

const stateResult = await runner.runWith('state-machine', document, undefined, (value) => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Invalid result')
  return value
})
console.log(stateResult.value)

const codeResult = await runner.runWith('codegen', document, undefined, (value) => {
  if (typeof value !== 'string') throw new Error('Invalid result')
  return value
})
console.log(codeResult.value)
