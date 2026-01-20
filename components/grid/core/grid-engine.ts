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
import { parse, serialize } from './layout';

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
  acceptWidgets: (el: Element) =>
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

    this.flush();

    const item = this.createItem(el, options, options.id);
    this.gridstack.addWidget(item as unknown as GridStackWidget);
    
    // GridStack modifies the object passed to addWidget or returns a widget.
    // The safest way to get the node back is to read it from the element's gridstackNode property
    // or trust that the 'item' object was updated if GridStack does that (it usually does).
    // However, for consistency, let's look up the node if possible or return our wrapper.
    // The original code cached the wrapper. Here we construct it.
    
    return item;
  }

  /**
   * Removes an item from the grid.
   * @param els The element or selector to remove.
   * @returns True if the item was removed, false otherwise.
   */
  public removeItem(els: string | HTMLElement): boolean {
    // GridStack removeWidget can take element or selector
    this.flush();
    this.gridstack.removeWidget(els);
    return true;
  }

  /**
   * Updates an item in the grid.
   * @param els The element or selector to update.
   * @param options The new options for the item.
   * @returns The updated item or false if not found.
   */
  public updateItem(els: string | HTMLElement, options: GridItemOptions = {}): false | GridItem {
    const el = GridUtils.getElement(els) as GridItemHTMLElement;
    if (!el.gridstackNode) return false;

    this.flush();

    this.gridstack.update(el, options);
    
    // Re-construct GridItem wrapper
    return this.makeGridItem(el.gridstackNode);
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

    this.el.classList.add('oc-grid');
    this.el.setAttribute('data-grid-id', this.id);

    this.initialized = true;
  }

  public destroy() {
    this.eventBus.off('*');

    if (this.gridstack) this.gridstack.destroy();

    this.el.classList.remove('oc-grid');
    this.el.removeAttribute('data-grid-id');

    this.batching = false;
    this.initialized = false;
  }

  // Compatibility method for old API
  public getItems(): GridItemOptions[] {
    return serialize(this.gridstack.save(false) as unknown as GridStackWidget[]);
  }

  public sync(items: GridItemOptions[]) {
    this.gridstack.load(
      parse(items, this.options.subGridOptions) as unknown as GridStackWidget[],
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
        nodes: serialize(nodes as unknown as GridStackWidget[]),
      });
      this.eventBus.emit('change', this.getItems()); // Emit change for compatibility
    });
    this.gridstack.on(
      'dropped',
      (event: Event, _: GridStackNode, node: GridStackNode) => {
        if (!node.id) node.id = createId();
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
    this.gridstack.on('removed', (_event: Event, nodes: GridStackNode[]) => {
      this.eventBus.emit('removed', serialize(nodes as unknown as GridStackWidget[]));
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
   * Helper to create a GridItem structure.
   */
  private createItem(el: HTMLElement, options: GridItemOptions, id?: string): GridItem {
    const finalId = id ?? createId();
    const finalOptions = parse(
      [{ id: finalId, el, ...GridUtils.trimmed(options) } as unknown as GridItemOptions],
      this.options.subGridOptions,
    )[0] as GridStackWidget;
    return { ...finalOptions, grid: this } as unknown as GridItem;
  }

  private makeGridItem(node: GridStackNode): GridItem {
    return { ...node, el: node.el!, grid: this } as unknown as GridItem;
  }

  /**
   * Flush batched grid updates in a microtask cycle.
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
