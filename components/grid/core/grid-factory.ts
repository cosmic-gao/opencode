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

  public createGrid(els: string | HTMLElement, options: GridEngineOptions = {}): GridEngine {
    const el = GridUtils.getElement(els)

    const grid = new GridEngine(el, options)
    this.grids.set(grid.id, grid)

    const resolver = this.resolvers.get(grid.id)
    if (resolver) resolver(grid)

    return grid
  }

  public getGrid(els: string | HTMLElement): GridEngine | undefined {
    const id = this.resolveId(els)!
    return this.grids.get(id);
  }

  public async waitForGrid(els: string | HTMLElement): Promise<GridEngine> {
    const id = this.resolveId(els)!;

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
