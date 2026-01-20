import {
  type DDDragOpt,
  type GridItemHTMLElement,
  type GridStackNode,
  type GridStackOptions,
  type GridStackWidget,
} from 'gridstack';
import {
  type Handler as EventCallback,
  Signal as EventBus,
  type WildcardHandler as WildcardCallback,
} from '@opencode/signal';
import { createId } from './create-id';
import { microtask } from './microtask';
import { DragEngine } from './drag-engine';
import { GridStack } from './grid-stack';
import { GridUtils } from './utils';
import { denormalizeLayout, normalizeLayout } from './layout';

export interface GridItemOptions extends Omit<GridStackWidget, 'content'> {
  children?: GridItemOptions[];
  data?: unknown;
}

export interface DragItemOptions<T> extends GridItemOptions {
  /**
   * Optional payload data associated with the item when dragging it
   * from an external source into the grid.
   *
   * This can be any custom information you want to attach, such as:
   * - item id
   * - type or category
   * - metadata for rendering
   *
   * The generic type `T` ensures type safety for the attached data.
   */
  data?: T;
}

export interface GridItem extends GridItemOptions {
  el: HTMLElement;
  grid: GridEngine;
}

export interface GridEngineOptions extends Omit<GridStackOptions, 'children'> {
  id?: string;
  dragInOptions?: DDDragOpt;
  dragIn?: string | HTMLElement[];
  subGridOptions?: Omit<GridStackOptions, 'children'>;
}

export interface GridEngineSpec {
  readonly id: string;
  el: HTMLElement;
  options: GridEngineOptions;
  driver: DragEngine;
}

export interface GridEvent {
  dropped: { event: Event; node: DragItemOptions<unknown> };
  added: { event: Event; nodes: GridItemOptions[] };
  change: GridItemOptions[];
  removed: GridItemOptions[];
  dragstart: { event: Event; el: unknown };
  dragstop: { event: Event; el: unknown };
  resizestart: { event: Event; el: unknown };
  resizestop: { event: Event; el: unknown };
  [key: string]: unknown;
}

export const GRID_ITEM_ATTRS = {
  x: 'x',
  y: 'y',
  w: 'w',
  h: 'h',
  maxW: 'max-w',
  maxH: 'max-h',
  minW: 'min-w',
  minH: 'min-h',
  noResize: 'no-resize',
  noMove: 'no-move',
  locked: 'locked',
  static: 'static',
  id: 'id',
  sizeToContent: 'size-to-content',
  autoPosition: 'auto-position',
} as const;

const DROP_KEYS = [...Object.keys(GRID_ITEM_ATTRS), 'children', 'data'] as const;

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  typeof window !== 'undefined' ? window.navigator.userAgent : '',
);

const dragDropOptions: GridEngineOptions = {
  alwaysShowResizeHandle: isMobile,
  resizable: {
    autoHide: !isMobile,
    handles: 'se',
  },
  acceptWidgets: (el: GridItemHTMLElement) =>
    el.matches('.grid-drag-portal') || el.matches('.grid-stack-item'),
  dragIn: '.grid-drag-portal', // class that can be dragged from outside
  dragInOptions: { scroll: true, appendTo: 'body', helper: 'clone' },
  removable: '.grid-stack-library-trash', // drag-out delete class
};

const displayOptions: GridEngineOptions = {
  column: 12,
  cellHeight: 160,
  margin: 8,
  float: true,
  sizeToContent: true,
};

export class GridEngine implements GridEngineSpec {
  private static readonly GRID_ENGINE_OPTIONS: GridEngineOptions = {
    ...displayOptions,
    ...dragDropOptions,
    disableDrag: false,
    disableResize: false,
    animate: true,
  };

  public readonly id: string;
  public readonly el: HTMLElement;
  public readonly driver: DragEngine;

  public options: GridEngineOptions;

  public readonly gridstack: GridStack;
  public readonly eventBus: EventBus<GridEvent> = new EventBus();

  private items: Map<string, GridItem> = new Map();

  private initialized: boolean = false;
  private batching: boolean = false;

  public constructor(els: string | HTMLElement, options: GridEngineOptions = {}) {
    this.el = GridUtils.getElement(els);
    this.id = options?.id ?? createId();

    this.options = this.configure(options);
    this.gridstack = GridStack.init(this.options, this.el) as GridStack;

    this.driver = new DragEngine(this);

    this.setup();
  }

  /**
   * Adds an item to the grid.
   * @param els The element or selector to add.
   * @param options Options for the grid item.
   * @returns The added grid item.
   */
  public addItem(els: string | HTMLElement, options: GridItemOptions = {}): GridItem {
    const el = GridUtils.getElement(els);

    if (options.id && this.items.has(options.id)) {
      return this.items.get(options.id)!;
    }

    this.flush();

    const item = this.createItem(el, options, options.id);
    this.gridstack.addWidget(item);
    this.items.set(item.id!, item);

    return item;
  }

  /**
   * Removes an item from the grid.
   * @param els The element or selector to remove.
   * @returns True if the item was removed, false otherwise.
   */
  public removeItem(els: string | HTMLElement): boolean {
    const id = GridUtils.getId(els);
    if (!this.items.has(id)) return false;

    this.flush();

    this.gridstack.removeWidget(els);
    this.items.delete(id);
    return true;
  }

  /**
   * Updates an item in the grid.
   * @param els The element or selector to update.
   * @param options The new options for the item.
   * @returns The updated item or false if not found.
   */
  public updateItem(els: string | HTMLElement, options: GridItemOptions = {}): false | GridItem {
    const id = GridUtils.getId(els);

    let item = this.items.get(id) ?? null;
    if (!item) {
      const el = GridUtils.getElement(els) as GridItemHTMLElement;
      if (!el.gridstackNode) return false;

      item = this.createItem(el, options, id);
    }

    this.flush();

    const { el, grid, ...opts } = item;
    this.gridstack.update(els, opts);
    this.items.has(id) ? Object.assign(item, opts) : this.items.set(id, item!);

    return item;
  }

  public on<K extends keyof GridEvent>(
    type: K,
    callback: EventCallback<GridEvent[K]>,
  ): () => void;
  public on<K extends keyof GridEvent>(
    type: '*',
    callback: WildcardCallback<GridEvent>,
  ): () => void;
  public on<K extends keyof GridEvent>(
    type: K | '*',
    callback: EventCallback<GridEvent[K]> | WildcardCallback<GridEvent>,
  ): () => void {
    return this.eventBus.on(type, callback);
  }

  public emit<K extends keyof GridEvent>(type: K, event: GridEvent[K]): void {
    this.eventBus.emit(type, event);
  }

  public setup() {
    if (this.initialized) return;

    this.setupEvents();

    this.el.classList.add('sylas-grid');
    this.el.setAttribute('data-grid-id', this.id);

    this.initialized = true;
  }

  public destroy() {
    this.eventBus.off('*');

    if (this.gridstack) this.gridstack.destroy();

    this.items.clear();

    this.el.classList.remove('sylas-grid');
    this.el.removeAttribute('data-grid-id');

    this.batching = false;
    this.initialized = false;
  }

  // Compatibility method for old API
  public getItems(): GridItemOptions[] {
    return normalizeLayout(this.gridstack.save(false) as unknown as GridStackWidget[]);
  }

  public sync(items: GridItemOptions[]) {
    this.gridstack.load(
      denormalizeLayout(items, this.options.subGridOptions) as unknown as GridStackWidget[],
    );
  }

  public make(el: HTMLElement) {
    return this.gridstack.makeWidget(el);
  }

  /**
   * Re-initialization method for old API compatibility.
   * Constructor already performs initialization, this is a no-op.
   * @deprecated Use constructor instead.
   */
  public init(_: HTMLElement, __: GridEngineOptions) {
    return this;
  }

  private setupEvents() {
    this.gridstack.on('added', (event: Event, nodes: GridStackNode[]) => {
      this.eventBus.emit('added', {
        event,
        nodes: normalizeLayout(nodes as unknown as GridStackWidget[]),
      });
      this.eventBus.emit('change', this.getItems()); // Emit change for compatibility
    });
    this.gridstack.on(
      'dropped',
      (event: Event, _: GridStackNode, node: GridStackNode) => {
        this.eventBus.emit('dropped', {
          event,
          node: GridUtils.pick(
            node as unknown as Record<string, unknown>,
            DROP_KEYS as unknown as (keyof GridStackNode)[],
          ) as unknown as DragItemOptions<unknown>,
        });
      },
    );
    this.gridstack.on('change', () => {
      this.eventBus.emit('change', this.getItems());
    });
    this.gridstack.on('removed', (event: Event, nodes: GridStackNode[]) => {
      this.eventBus.emit('removed', normalizeLayout(nodes as unknown as GridStackWidget[]));
      this.eventBus.emit('change', this.getItems());
    });

    // Forward other events
    const events = ['dragstart', 'dragstop', 'resizestart', 'resizestop'];
    events.forEach((evt) => {
      this.gridstack.on(evt, (event: Event, el: any) => {
        this.eventBus.emit(evt, { event, el });
      });
    });
  }

  /**
   * el: Existing DOM element reference (typically a `.grid-stack-item` node).
   *
   * Providing `el` allows GridStack's `addWidget()` to **reuse** an existing element
   * instead of creating a new widget container. This ensures that the original DOM
   * structure, event bindings, and internal state are preserved.
   */
  private createItem(el: HTMLElement, options: GridItemOptions, id?: string): GridItem {
    const finalId = id ?? createId();
    const finalOptions = denormalizeLayout(
      [{ id: finalId, el, ...GridUtils.trimmed(options) } as unknown as GridItemOptions],
      this.options.subGridOptions,
    )[0] as GridStackWidget;
    return { ...finalOptions, grid: this } as unknown as GridItem;
  }

  /**
   * Flush batched grid updates in a microtask cycle.
   *
   * Ensures `gridstack.batchUpdate()` is called once per microtask,
   * then automatically closed (`batchUpdate(false)`) after all synchronous
   * changes finish. Prevents redundant reflows during rapid updates.
   */
  private flush() {
    if (this.batching) return;

    this.batching = true;
    this.gridstack.batchUpdate();

    microtask(() => {
      try {
        this.gridstack.batchUpdate(false);
      } finally {
        this.batching = false;
      }
    });
  }

  private configure(options: GridEngineOptions): GridEngineOptions {
    return { ...GridEngine.GRID_ENGINE_OPTIONS, ...options, id: this.id };
  }
}
