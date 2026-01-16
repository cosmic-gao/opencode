import { createDocument } from '../src/neutral/document'
import type { SyntaxNode } from '../src/syntax/node'
import { HtmlAdapter } from '../src/adapter/html'
import { VueAdapter } from '../src/adapter/vue'
import { JavascriptAdapter } from '../src/adapter/javascript'
import { TypescriptAdapter } from '../src/adapter/typescript'
import type { Adapter } from '../src/adapter/adapter'

// 导入原始文本
import nativeHtml from './presets/native.html?raw'
import sfcVue from './presets/sfc.vue?raw'
import demoJs from './presets/demo.js?raw'
import demoTs from './presets/demo.ts?raw'

const htmlAdapter = new HtmlAdapter()
const vueAdapter = new VueAdapter()
const jsAdapter = new JavascriptAdapter()
const tsAdapter = new TypescriptAdapter()

const presets = {
  'native-html': { content: nativeHtml, adapter: htmlAdapter },
  'sfc-vue': { content: sfcVue, adapter: vueAdapter },
  'demo-js': { content: demoJs, adapter: jsAdapter },
  'demo-ts': { content: demoTs, adapter: tsAdapter },
}

type AppElements = {
  source: HTMLTextAreaElement
  diagnostics: HTMLPreElement
  ast: HTMLPreElement
  model: HTMLPreElement
  status: HTMLElement
  select: HTMLSelectElement
}

function formatDiagnostics(list: { level: string; code: string; message: string }[]): string {
  if (!list.length) return '无诊断'
  return JSON.stringify(list, null, 2)
}

function serializer(key: string, value: unknown): unknown {
  if (key === 'loc' && value && typeof value === 'object') {
    const span = value as { start: { line: number; column: number }; end: { line: number; column: number } }
    return {
      start: `${span.start.line}:${span.start.column}`,
      end: `${span.end.line}:${span.end.column}`,
    }
  }
  return value
}

function buildNeutralDocument(nodes: SyntaxNode[]) {
  const document = createDocument()
  let fallbackCount = 0
  const queue = [...nodes]
  while (queue.length) {
    const node = queue.shift()!
    document.entities.push({
      type: node.type,
      name: node.name ?? `${node.type}-${fallbackCount++}`,
      attrs: node.attrs,
      span: node.loc,
      meta: node.meta,
      tags: node.tags,
    })
    if (node.children) queue.push(...node.children)
  }
  return document
}

function getElements(): AppElements | null {
  const source = document.querySelector<HTMLTextAreaElement>('.source-editor')
  const diagnostics = document.querySelector<HTMLPreElement>('.output-diagnostics')
  const ast = document.querySelector<HTMLPreElement>('.output-ast')
  const model = document.querySelector<HTMLPreElement>('.output-model')
  const status = document.getElementById('status')
  const select = document.getElementById('preset-select') as HTMLSelectElement

  if (source && diagnostics && ast && model && status && select) {
    return { source, diagnostics, ast, model, status, select }
  }
  return null
}

function update(elements: AppElements, text: string, adapter: Adapter) {
  try {
    const adaptResult = adapter.parse(text)
    const nodes = adaptResult.nodes
    const document = buildNeutralDocument(nodes)

    elements.diagnostics.textContent = formatDiagnostics(adaptResult.diagnostics)
    elements.ast.textContent = JSON.stringify(nodes, serializer, 2)
    elements.model.textContent = JSON.stringify(document, null, 2)
    
    elements.status.textContent = `已解析 (${adapter.name})`
    elements.status.className = 'status-badge success'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    elements.diagnostics.textContent = `解析失败：${message}`
    elements.status.textContent = '错误'
    elements.status.className = 'status-badge error'
  }
}

function loadPreset(key: string, elements: AppElements) {
  const preset = presets[key as keyof typeof presets]
  if (!preset) return

  try {
    const sourceText = preset.content
    elements.source.value = sourceText
    update(elements, sourceText, preset.adapter)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    elements.diagnostics.textContent = `加载失败：${message}`
  }
}

function init(): void {
  const elements = getElements()
  if (!elements) return

  // Setup event listeners
  elements.source.addEventListener('input', () => {
    const key = elements.select.value
    const preset = presets[key as keyof typeof presets]
    if (preset) {
      update(elements, elements.source.value, preset.adapter)
    }
  })

  elements.select.addEventListener('change', () => {
    loadPreset(elements.select.value, elements)
  })

  // Load default
  loadPreset('native-html', elements)
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init()
} else {
  document.addEventListener('DOMContentLoaded', () => init(), { once: true })
}
