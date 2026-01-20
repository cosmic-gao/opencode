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

  private pending: Map<string, Set<{
    resolve: (engine: GridEngine) => void;
    reject: (error: Error) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
    signal?: AbortSignal;
    abortListener?: () => void;
  }>> = new Map();

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

    const waiters = this.pending.get(grid.id);
    if (waiters) {
      waiters.forEach((waiter) => {
        if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
        if (waiter.signal && waiter.abortListener) {
          waiter.signal.removeEventListener('abort', waiter.abortListener);
        }
        waiter.resolve(grid);
      });
      this.pending.delete(grid.id);
    }

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
   * - 默认不会自动超时（不传 timeoutMs 时为无限等待）
   * - 可通过 AbortSignal 取消等待
   * 
   * @param els 网格 id（字符串）或已挂载的网格元素
   * @param options 可选项：超时与取消
   * @returns Promise<GridEngine> 目标网格实例
   * @throws 若无法解析 ID 则抛出错误
   * @throws 若超时或被取消则抛出错误
   * 
   * @example
   * // DragPortal 等待目标网格
   * const grid = await factory.waitForGrid('main-grid', { timeoutMs: 3000 })
   * grid.driver.setupDragIn(el, options)
   */
  public async waitForGrid(
    els: string | HTMLElement,
    options: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<GridEngine> {
    const id = this.resolveId(els);
    if (!id) {
      throw new Error('GridFactory.waitForGrid: Unable to resolve grid ID from element');
    }

    const grid = this.grids.get(id);
    if (grid) return grid;

    const { timeoutMs, signal } = options;
    if (signal?.aborted) {
      const error = new Error('GridFactory.waitForGrid: Aborted');
      error.name = 'AbortError';
      throw error;
    }

    return new Promise<GridEngine>((resolve, reject) => {
      const waiter = { resolve, reject, signal } as {
        resolve: (engine: GridEngine) => void;
        reject: (error: Error) => void;
        timeoutId?: ReturnType<typeof setTimeout>;
        signal?: AbortSignal;
        abortListener?: () => void;
      };

      const waiters = this.pending.get(id) ?? new Set();
      waiters.add(waiter);
      this.pending.set(id, waiters);

      if (typeof timeoutMs === 'number' && timeoutMs > 0) {
        waiter.timeoutId = setTimeout(() => {
          waiters.delete(waiter);
          if (waiters.size === 0) this.pending.delete(id);
          if (waiter.signal && waiter.abortListener) {
            waiter.signal.removeEventListener('abort', waiter.abortListener);
          }
          const error = new Error(`GridFactory.waitForGrid: Timeout after ${timeoutMs}ms`);
          error.name = 'TimeoutError';
          reject(error);
        }, timeoutMs);
      }

      if (signal) {
        const abortListener = () => {
          if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
          waiters.delete(waiter);
          if (waiters.size === 0) this.pending.delete(id);
          const error = new Error('GridFactory.waitForGrid: Aborted');
          error.name = 'AbortError';
          reject(error);
        };
        waiter.abortListener = abortListener;
        signal.addEventListener('abort', abortListener, { once: true });
      }
    });
  }

  public destroy() {
    this.grids.forEach(grid => grid.destroy());
    this.grids.clear()

    this.pending.forEach((waiters) => {
      waiters.forEach((waiter) => {
        if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
        if (waiter.signal && waiter.abortListener) {
          waiter.signal.removeEventListener('abort', waiter.abortListener);
        }
        const error = new Error('GridFactory.destroy: GridFactory has been destroyed');
        error.name = 'DestroyedError';
        waiter.reject(error);
      });
    });
    this.pending.clear()
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
