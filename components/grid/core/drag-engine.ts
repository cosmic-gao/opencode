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
import { GridUtils } from "./utils";

export class DragEngine {
  private readonly grid: GridEngine;

  public constructor(grid: GridEngine) {
    this.grid = grid

    this.setupAccept()
  }

  /**
   * Destroys the drag-in functionality for the given element.
   * @param element The element to destroy drag-in for.
   */
  public destroyDragIn(element: HTMLElement): DDGridStack {
    return this.getDD().draggable(element, 'destroy')
  }

  /**
   * Sets up drag-in functionality for an element.
   * @param element The element to make draggable.
   * @param item The grid item options associated with the element.
   * @param helper Optional helper function or string for the drag helper.
   */
  public setupDragIn<T>(element: HTMLElement, item: DragItemOptions<T>, helper?: 'clone' | ((el: HTMLElement) => HTMLElement)) {
    const ddElement = DDElement.init(element);
    (element as GridItemHTMLElement).gridstackNode = item;

    ddElement.setupDraggable({
      ...this.grid.options.dragInOptions,
      helper: helper ?? this.grid.options.dragInOptions?.helper,
      handle: this.grid.options.handle
    })
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
    const node: GridStackNode = el.gridstackNode || gridStack._readAttr(el, false);
    
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
      that._leave(el, helper);

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
    delete that.placeholder.gridstackNode;

    this.handleAnimation(wasAdded, that);

    const origNode = el._gridstackNodeOrig!;
    delete el._gridstackNodeOrig;

    this.handleOriginalNode(wasAdded, origNode, that);

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

    that._removeDD(finalEl);
    if (!wasAdded) return false;

    Utils.copyPos(node, that._readAttr(that.placeholder));
    Utils.removePositioningStyles(finalEl);
    that.engine.removeNode(node);

    that._updateContainerHeight();
    that._triggerChangeEvent();
    that.engine.endUpdate();

    if (that._gsEventHandler['dropped']) {
      that._gsEventHandler['dropped'](
        { ...event, type: 'dropped' },
        origNode,
        GridUtils.pick(node, Object.keys(GRID_ITEM_ATTRS) as unknown as (keyof GridStackWidget)[])
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
