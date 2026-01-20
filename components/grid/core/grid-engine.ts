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
import { fromLayout, GridUtils, parse, serialize, toLayout, type LayoutItem } from './utils';

export interface GridItemOptions<T = unknown> extends Omit<GridStackWidget, 'content'> {
  children?: GridItemOptions<T>[];
  data?: T;
}

/**
 * 用于外部拖入场景的网格项配置（可携带强类型 data）。
 *
 * @typeParam T data 的类型
 */
export interface DragItemOptions<T = unknown> extends GridItemOptions<T> {}

export interface GridItem<T = unknown> extends GridItemOptions<T> {
  el: HTMLElement;
  grid: GridEngine<T>;
}

export interface GridEngineOptions extends Omit<GridStackOptions, 'children'> {
  id?: string;
  dragInOptions?: DDDragOpt;
  dragIn?: string | HTMLElement[];
  subGridOptions?: Omit<GridStackOptions, 'children'>;
}

export interface GridEngineSpec<T = unknown> {
  readonly id: string;
  el: HTMLElement;
  options: GridEngineOptions;
  driver: DragEngine<T>;
}

export interface GridEvent<T = unknown> {
  dropped: { event: Event; node: DragItemOptions<T> };
  added: { event: Event; nodes: GridItemOptions<T>[] };
  change: GridItemOptions<T>[];
  removed: GridItemOptions<T>[];
  dragstart: { event: Event; el: HTMLElement | GridItemHTMLElement };
  dragstop: { event: Event; el: HTMLElement | GridItemHTMLElement };
  resizestart: { event: Event; el: HTMLElement | GridItemHTMLElement };
  resizestop: { event: Event; el: HTMLElement | GridItemHTMLElement };
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

export class GridEngine<T = unknown> implements GridEngineSpec<T> {
  private static readonly GRID_ENGINE_OPTIONS: GridEngineOptions = {
    ...displayOptions,
    ...dragDropOptions,
    disableDrag: false,
    disableResize: false,
    animate: true,
  };

  public readonly id: string;
  public readonly el: HTMLElement;
  public readonly driver: DragEngine<T>;

  public options: GridEngineOptions;

  public readonly gridstack: GridStack;
  public readonly eventBus: EventBus<GridEvent<T>> = new EventBus();

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
   * 添加一个网格项到当前网格中。
   *
   * 约束：
   * - `els` 必须能解析到一个已存在的 HTMLElement
   * - 若 `options.id` 未提供，会自动生成唯一 id
   * - GridStack 可能会修改传入的 widget，返回值始终以最终的 `gridstackNode` 为准
   *
   * @param els 目标元素或选择器
   * @param options 网格项配置（坐标、尺寸、children、data 等）
   * @returns 标准化的网格项（包含 el 与 grid 引用）
   * @throws 若元素无法解析或 GridStack 未能写入 gridstackNode
   *
   * @example
   * const item = grid.addItem(el, { w: 3, h: 2, data: { type: 'card' } })
   * console.log(item.id, item.el)
   */
  public addItem(els: string | HTMLElement, options: GridItemOptions<T> = {}): GridItem<T> {
    const el = GridUtils.getElement(els) as GridItemHTMLElement;

    this.flush();

    const widget = this.createWidget(el, options, options.id);
    const added = this.gridstack.addWidget(widget as unknown as GridStackWidget) as
      | GridItemHTMLElement
      | undefined;

    const finalEl = (added ?? el) as GridItemHTMLElement;
    const node = finalEl.gridstackNode;
    if (!node) {
      throw new Error('GridEngine.addItem: Unable to read gridstackNode after addWidget');
    }

    return this.makeGridItem(node);
  }

  /**
   * 从网格中移除一个网格项。
   *
   * 约束：
   * - 若 `els` 为选择器且未匹配到元素，则返回 false
   * - 仅在元素曾是网格项（存在 gridstackNode）时返回 true
   *
   * @param els 目标元素或选择器
   * @returns 是否实际移除了一个网格项
   *
   * @example
   * const removed = grid.removeItem('#item-1')
   * if (!removed) console.warn('not found')
   */
  public removeItem(els: string | HTMLElement): boolean {
    const el = typeof els === 'string'
      ? (document.querySelector(els) as GridItemHTMLElement | null)
      : (els as GridItemHTMLElement);

    if (!el) return false;
    const existed = !!el.gridstackNode;

    this.flush();
    this.gridstack.removeWidget(el);
    return existed;
  }

  /**
   * 更新一个已存在的网格项。
   *
   * @param els 目标元素或选择器
   * @param options 要更新的配置（仅传入需要更新的字段）
   * @returns 更新后的网格项；若未找到或不是网格项则返回 false
   *
   * @example
   * const next = grid.updateItem(el, { w: 6, h: 2 })
   * if (next) console.log(next.w, next.h)
   */
  public updateItem(els: string | HTMLElement, options: GridItemOptions<T> = {}): false | GridItem<T> {
    const el = typeof els === 'string'
      ? (document.querySelector(els) as GridItemHTMLElement | null)
      : (els as GridItemHTMLElement);
    if (!el?.gridstackNode) return false;

    this.flush();

    this.gridstack.update(el, options);

    return this.makeGridItem(el.gridstackNode);
  }

  public on<K extends keyof GridEvent<T>>(
    type: K,
    callback: EventCallback<GridEvent<T>[K]>,
  ): () => void;
  public on(type: '*', callback: WildcardCallback<GridEvent<T>>): () => void;
  public on(
    type: keyof GridEvent<T> | '*',
    callback:
      | EventCallback<GridEvent<T>[keyof GridEvent<T>]>
      | WildcardCallback<GridEvent<T>>,
  ): () => void {
    return this.eventBus.on(type, callback);
  }

  public emit<K extends keyof GridEvent<T>>(type: K, event: GridEvent<T>[K]): void {
    this.eventBus.emit(type, event);
  }

  /**
   * 初始化网格（构造函数已自动调用）。
   *
   * @example
   * const grid = new GridEngine(el)
   * grid.setup()
   */
  public setup() {
    if (this.initialized) return;

    this.setupEvents();

    this.el.classList.add('oc-grid');
    this.el.setAttribute('data-grid-id', this.id);

    this.initialized = true;
  }

  /**
   * 销毁网格实例并清理事件与 DOM 标记。
   *
   * @example
   * grid.destroy()
   */
  public destroy() {
    this.eventBus.off('*');

    if (this.gridstack) this.gridstack.destroy();

    this.el.classList.remove('oc-grid');
    this.el.removeAttribute('data-grid-id');

    this.batching = false;
    this.initialized = false;
  }

  /**
   * 获取当前网格布局（兼容旧 API）。
   *
   * @returns 可序列化的布局列表
   * @example
   * const layout = grid.getItems()
   */
  public getItems(): GridItemOptions<T>[] {
    return serialize<T>(this.gridstack.save(false) as unknown as GridStackWidget[]);
  }

  /**
   * 获取当前网格布局（稳定模型）。
   *
   * @returns 可持久化的布局列表
   * @example
   * const layout = grid.getLayout()
   */
  public getLayout(): LayoutItem[] {
    return toLayout(this.gridstack.save(false) as unknown as GridStackWidget[]);
  }

  /**
   * 将布局同步到网格中。
   *
   * @param items 对外布局列表
   * @example
   * grid.sync(layout)
   */
  public sync(items: GridItemOptions<T>[]) {
    this.gridstack.load(
      parse<T>(items, this.options.subGridOptions) as unknown as GridStackWidget[],
    );
  }

  /**
   * 将稳定布局模型同步到网格中。
   *
   * @param items 对外稳定布局列表
   * @example
   * grid.syncLayout(layout)
   */
  public syncLayout(items: LayoutItem[]) {
    this.gridstack.load(fromLayout(items, this.options.subGridOptions));
  }

  /**
   * 使一个 DOM 元素成为可被 GridStack 管理的网格项。
   *
   * @param el 目标元素
   * @returns gridstack 返回的元素
   * @example
   * grid.make(el)
   */
  public make(el: HTMLElement) {
    return this.gridstack.makeWidget(el);
  }

  private setupEvents() {
    this.gridstack.on('added', (event: Event, nodes: GridStackNode[]) => {
      this.eventBus.emit('added', {
        event,
        nodes: serialize<T>(nodes as unknown as GridStackWidget[]),
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
          ) as unknown as DragItemOptions<T>,
        });
      },
    );
    this.gridstack.on('change', () => {
      this.eventBus.emit('change', this.getItems());
    });
    this.gridstack.on('removed', (_event: Event, nodes: GridStackNode[]) => {
      this.eventBus.emit('removed', serialize<T>(nodes as unknown as GridStackWidget[]));
      this.eventBus.emit('change', this.getItems());
    });

    // Forward other events
    const events = ['dragstart', 'dragstop', 'resizestart', 'resizestop'] as const;
    events.forEach((evt) => {
      this.gridstack.on(evt, (event: Event, el: GridItemHTMLElement | HTMLElement) => {
        this.eventBus.emit(evt, { event, el });
      });
    });
  }

  private createWidget(el: HTMLElement, options: GridItemOptions<T>, id?: string): GridStackWidget {
    const finalId = id ?? createId();
    const finalOptions = parse<T>(
      [{ id: finalId, el, ...GridUtils.trimmed(options) } as unknown as GridItemOptions<T>],
      this.options.subGridOptions,
    )[0] as GridStackWidget;
    return finalOptions;
  }

  private makeGridItem(node: GridStackNode): GridItem<T> {
    return { ...node, el: node.el!, grid: this } as unknown as GridItem<T>;
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
