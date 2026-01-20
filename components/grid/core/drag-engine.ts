import {
  type DDGridStack,
  type GridItemHTMLElement,
  type GridStackNode,
  type GridStackWidget,
  DDElement,
  Utils
} from "gridstack";
import { type DragItemOptions, GridEngine, GRID_ITEM_ATTRS } from "./grid-engine";
import { GridStack } from "./grid-stack"
import { leaveGrid, readNode, removeDrag, triggerChange, updateHeight } from "./gridstack-adapter";
import { GridUtils } from "./utils";

const getDropKeys = () => [...Object.keys(GRID_ITEM_ATTRS), "children", "data"] as const;

export class DragEngine {
  private readonly grid: GridEngine;

  public constructor(grid: GridEngine) {
    this.grid = grid

    this.setupAccept()
  }

  /**
   * 销毁元素的拖拽功能
   * @param element 要销毁拖拽功能的元素
   * @returns DDGridStack 实例
   */
  public destroyDragIn(element: HTMLElement): DDGridStack {
    return this.getDD().draggable(element, 'destroy')
  }

  /**
   * 设置外部拖拽源
   * 
   * 将元素配置为可拖拽进网格的外部源。元素必须有 gridstackNode 属性才能被识别。
   * 
   * @param element 要设置为拖拽源的元素
   * @param item 拖拽项配置（尺寸、数据等）
   * @param helper 拖拽辅助模式（'clone' 或自定义函数）
   */
  public setupDragIn<T>(element: HTMLElement, item: DragItemOptions<T>, helper?: 'clone' | ((el: HTMLElement) => HTMLElement)) {
    const ddElement = DDElement.init(element);
    (element as GridItemHTMLElement).gridstackNode = item as unknown as GridStackNode;

    const dragOptions = {
      ...this.grid.options.dragInOptions,
      helper: helper ?? this.grid.options.dragInOptions?.helper,
      handle: this.grid.options.handle
    };
    ddElement.setupDraggable(dragOptions);
  }

  private setupAccept() {
    if (!this.grid) return;

    if (this.shouldDestroyDroppable()) {
      this.getDD().droppable(this.grid.gridstack.el, 'destroy');
      return;
    }

    if (!this.getDD().isDroppable(this.grid.gridstack.el)) {
      this.setupDroppable();
    }

    this.setupDropEvents();
  }

  private shouldDestroyDroppable(): boolean {
    return !!(this.grid.options.staticGrid || (!this.grid.options.acceptWidgets && !this.grid.options.removable));
  }

  private setupDroppable() {
    const that: GridStack = this.grid.gridstack;
    this.getDD().droppable(this.grid.el, {
      accept: (el: GridItemHTMLElement) => this.canAccept(el, that)
    });
  }

  private canAccept(el: GridItemHTMLElement, gridStack: GridStack): boolean {
    const node = readNode(gridStack, el);
    
    // set accept drop to true on ourself (which we ignore) so we don't get "can't drop" icon in HTML5 mode while moving
    if (node && node.grid === gridStack) return true;
    if (!gridStack.opts.acceptWidgets) return false;

    // check for accept method or class matching
    let canAccept = true;
    if (typeof gridStack.opts.acceptWidgets === 'function') {
      canAccept = gridStack.opts.acceptWidgets(el);
    } else {
      const selector = (gridStack.opts.acceptWidgets === true ? '.grid-stack-item' : gridStack.opts.acceptWidgets as string);
      canAccept = el.matches(selector);
    }

    // finally check to make sure we actually have space left #1571 #2633
    if (canAccept && node && gridStack.opts.maxRow) {
      const n = { w: node.w, h: node.h, minW: node.minW, minH: node.minH }; // only width/height matters and autoPosition
      canAccept = gridStack.engine.willItFit(n);
    }
    return canAccept;
  }

  private setupDropEvents() {
    const el = this.grid.gridstack.el;
    this.getDD()
      .off(el, 'dropout')
      .on(el, 'dropout', this.handleDropout.bind(this))
      .off(el, 'drop')
      .on(el, 'drop', this.handleDrop.bind(this));
  }

  private handleDropout(_: Event, el: GridItemHTMLElement, helper?: GridItemHTMLElement) {
    const that: GridStack = this.grid.gridstack;
    const node = helper?.gridstackNode || el.gridstackNode;
    if (!node) return false;

    /**
     * fix #1578 when dragging fast, we might get leave after another grid gets enter (which calls us to clean)
     * so skip this one if we're not the active grid really..
     */
    if (!node?.grid || node?.grid !== that) {
      leaveGrid(that, el, helper);

      if (that._isTemp) {
        that.removeAsSubGrid(node);
      }
    }
    return false;
  }

  private handleDrop(event: Event, el: GridItemHTMLElement, helper?: GridItemHTMLElement) {
    const that: GridStack = this.grid.gridstack;
    const node = (helper?.gridstackNode || el.gridstackNode) as GridStackNode;

    // ignore drop on ourself from ourself that didn't come from the outside
    if (node?.grid === that && !node._isExternal) return false;

    const wasAdded = !!that.placeholder.parentElement;
    that.placeholder.remove();
    (that.placeholder as unknown as { gridstackNode?: unknown }).gridstackNode = undefined;

    this.handleAnimation(wasAdded, that);

    const original = (el as unknown as { _gridstackNodeOrig?: GridStackNode })._gridstackNodeOrig;
    if (!original) return false;
    delete (el as unknown as { _gridstackNodeOrig?: GridStackNode })._gridstackNodeOrig;

    this.handleOriginalNode(wasAdded, original, that);

    if (!node) return false;

    if (wasAdded) {
      that.engine.cleanupNode(node); 
      node.grid = that;
    }

    delete node.grid?._isTemp;
    this.getDD().off(el, 'drag');

    // Handle helper/element replacement
    let finalEl = el;
    if (helper !== el) {
      helper?.remove();
      finalEl = helper!;
    } else {
      el.remove(); 
    }

    removeDrag(that, finalEl);
    if (!wasAdded) return false;

    const placeholderNode = readNode(that, that.placeholder);
    if (placeholderNode) Utils.copyPos(node, placeholderNode);
    Utils.removePositioningStyles(finalEl);
    that.engine.removeNode(node);

    updateHeight(that);
    triggerChange(that);
    that.engine.endUpdate();

    if (that._gsEventHandler['dropped']) {
      that._gsEventHandler['dropped'](
        { ...event, type: 'dropped' },
        original,
        (GridUtils.pick(
          node as unknown as Record<string, unknown>,
          getDropKeys() as unknown as (keyof GridStackWidget)[],
        ) as unknown as GridStackNode)
      );
    }
    return false;
  }

  private handleAnimation(wasAdded: boolean, gridStack: GridStack) {
    if (wasAdded && gridStack.opts.animate) {
      gridStack.setAnimation(false);
      gridStack.setAnimation(true, true); 
    }
  }

  private handleOriginalNode(wasAdded: boolean, origNode: GridStackNode, gridStack: GridStack) {
    if (wasAdded && origNode?.grid && origNode.grid !== gridStack) {
      const oGrid = origNode.grid as GridStack;
      oGrid.engine.removeNodeFromLayoutCache(origNode);
      oGrid.engine.removedNodes.push(origNode);
      oGrid._triggerRemoveEvent()._triggerChangeEvent();
      
      if (oGrid.parentGridNode && !oGrid.engine.nodes.length && oGrid.opts.subGridDynamic) {
        oGrid.removeAsSubGrid();
      }
    }
  }

  private getDD() {
    return GridStack.getDD()
  }
}
