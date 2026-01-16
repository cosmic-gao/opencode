import type { SyntaxNode } from '../../syntax/node'
import type { AdaptResult } from '../adapter'
import { CssAdapter } from '../css'
import { HtmlAdapter } from '../html'
import { JavascriptAdapter } from '../javascript'
import { TypescriptAdapter } from '../typescript'

/**
 * Vue 单文件组件 (SFC) 适配器。
 *
 * 基于 HtmlAdapter，但会同时解析 head 和 body 中的内容，
 * 以支持 template/script/style 等顶级块。
 */
export class VueAdapter extends HtmlAdapter {
  override readonly name = 'vue'

  private jsAdapter = new JavascriptAdapter()
  private tsAdapter = new TypescriptAdapter()
  private cssAdapter = new CssAdapter()

  /**
   * 判断输入文本是否为 Vue SFC。
   *
   * 简单的启发式规则：检查是否包含顶级标签。
   */
  override supports(text: string): boolean {
    return /^\s*<(template|script|style)/.test(text)
  }

  override parse(text: string): AdaptResult {
    // 复用 HtmlAdapter 的纯 JS 解析能力
    const result = super.parse(text)
    const { nodes } = result

    // 对解析出的节点进行后处理
    // HtmlParser 已经返回了所有根节点（包括 script/style/template）
    // 我们只需要遍历它们，对 script/style 标签进行增强
    for (const node of nodes) {
      this.enhanceNode(node)
    }

    return result
  }

  private enhanceNode(node: SyntaxNode) {
    // 针对 script 标签内容进行特殊处理
    if (node.kind === 'Element' && node.name === 'script' && node.children) {
      this.processScript(node)
    }
    
    // 针对 style 标签内容进行特殊处理
    if (node.kind === 'Element' && node.name === 'style' && node.children) {
      this.processStyle(node)
    }
    
    // 递归处理子节点
    if (node.children) {
      for (const child of node.children) {
        this.enhanceNode(child)
      }
    }
  }

  private processScript(node: SyntaxNode) {
    const content = this.extractTextContent(node)
    if (!content) return

    const lang = node.attrs?.lang
    const isTs = lang === 'ts' || lang === 'typescript' || lang === 'tsx'
    
    const adapter = isTs ? this.tsAdapter : this.jsAdapter
    const { nodes } = adapter.parse(content)
    
    node.children = nodes
  }

  private processStyle(node: SyntaxNode) {
    const content = this.extractTextContent(node)
    if (!content) return

    // 暂时都用 CSS 适配器，未来可支持 scss/less/stylus
    const { nodes } = this.cssAdapter.parse(content)
    
    node.children = nodes
  }

  private extractTextContent(node: SyntaxNode): string {
    if (!node.children) return ''
    return node.children
      .filter((child) => child.kind === 'Text')
      .map((child) => child.attrs?.value)
      .join('')
  }
}
