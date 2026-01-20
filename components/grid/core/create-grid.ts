import { type GridEngineOptions } from "./grid-engine";
import { GridFactory } from "./grid-factory";

export interface GridOptions extends GridEngineOptions {
}

/**
 * 创建网格实例
 * 
 * 作为对外暴露的工厂方法，简化网格创建流程。内部通过 GridFactory 单例
 * 管理所有网格实例，支持跨组件引用和异步等待。
 * 
 * @param els DOM 元素或选择器
 * @param options 网格配置项，包含布局、拖拽、尺寸等选项
 * @returns GridEngine 实例，可监听事件、操作网格项
 * 
 * @example
 * const grid = createGrid('#container', { 
 *   column: 12, 
 *   cellHeight: 100,
 *   float: true 
 * })
 * grid.on('change', (items) => void items)
 */
export function createGrid(els: string | HTMLElement, options?: GridOptions) {
  const instance = GridFactory.getInstance()
  return instance.createGrid(els, options)
}
