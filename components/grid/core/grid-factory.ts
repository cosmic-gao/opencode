import { type GridEngineOptions, GridEngine } from "./grid-engine";
import { GridUtils } from "./utils";

/**
 * Configuration options for GridFactory.
 * Reserved for future extensibility (e.g., default grid options, plugins).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GridFactoryOptions {}

/**
 * Specification interface for GridFactory implementations.
 * Reserved for future extensibility (e.g., additional factory methods).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GridFactorySpec {}

export class GridFactory implements GridFactorySpec {
  private static readonly GRID_FACTORY_OPTIONS: GridFactoryOptions = {};
  private static instance: GridFactory | null = null;

  public static getInstance(options?: GridFactoryOptions): GridFactory {
    if (!GridFactory.instance) {
      GridFactory.instance = new GridFactory(options)
    }
    return GridFactory.instance
  }

  private waiting: Map<string, Promise<GridEngine>> = new Map()
  private resolvers: Map<string, (engine: GridEngine) => void> = new Map();

  public options: GridFactoryOptions;
  public grids: Map<string, GridEngine> = new Map();

  public constructor(options: GridFactoryOptions = {}) {
    this.options = this.configure(options);

    this.initialize()
  }

  /**
   * 创建网格实例并注册到工厂
   * 
   * 若指定 id 的网格已存在，会触发等待队列中的 resolver。
   * 
   * @param els DOM 元素或选择器
   * @param options 网格配置，id 字段用于跨组件引用
   * @returns 新创建的 GridEngine 实例
   */
  public createGrid(els: string | HTMLElement, options: GridEngineOptions = {}): GridEngine {
    const el = GridUtils.getElement(els)

    const grid = new GridEngine(el, options)
    this.grids.set(grid.id, grid)

    const resolver = this.resolvers.get(grid.id)
    if (resolver) resolver(grid)

    return grid
  }

  public getGrid(els: string | HTMLElement): GridEngine | undefined {
    const id = this.resolveId(els);
    if (!id) {
      return undefined;
    }
    return this.grids.get(id);
  }

  /**
   * 异步等待网格实例创建完成
   * 
   * 用于跨组件场景：如 DragPortal 需引用尚未挂载的目标网格。
   * 若网格已存在立即返回，否则等待直到对应 id 的网格被创建。
   * 
   * 约束：
   * - 必须确保目标网格最终会被创建，否则 Promise 永不 resolve
   * - 不会自动超时，调用方需自行处理超时逻辑
   * 
   * @param els 网格 id（字符串）或已挂载的网格元素
   * @returns Promise<GridEngine> 目标网格实例
   * @throws 若无法解析 ID 则抛出错误
   * 
   * @example
   * // DragPortal 等待目标网格
   * const grid = await factory.waitForGrid('main-grid')
   * grid.driver.setupDragIn(el, options)
   */
  public async waitForGrid(els: string | HTMLElement): Promise<GridEngine> {
    const id = this.resolveId(els);
    if (!id) {
      throw new Error('GridFactory.waitForGrid: Unable to resolve grid ID from element');
    }

    const grid = this.grids.get(id);
    if (grid) return grid;

    if (this.waiting.has(id)) return this.waiting.get(id)!;

    const promise = new Promise<GridEngine>((resolve) => this.resolvers.set(id, (engine) => {
      resolve(engine)

      this.resolvers.delete(id)
      this.waiting.delete(id)
    }))

    this.waiting.set(id, promise)
    return promise
  }

  public destroy() {
    this.grids.forEach(grid => grid.destroy());
    this.grids.clear()
    this.waiting.clear()
    this.resolvers.clear()
  }

  private initialize() {
    if (typeof window === 'undefined') return

    window.addEventListener('beforeunload', () => {
      this.destroy()
    })
  }

  private resolveId(els: string | HTMLElement): string | null {
    return typeof els === 'string'
      ? els
      : els.getAttribute('data-grid-id');
  }

  private configure(options: GridFactoryOptions): GridFactoryOptions {
    return { ...GridFactory.GRID_FACTORY_OPTIONS, ...options }
  }
}
