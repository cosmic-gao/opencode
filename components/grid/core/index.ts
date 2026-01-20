import 'gridstack/dist/gridstack.min.css';
import { GridStack, GridStackOptions, GridStackWidget, GridStackNode } from 'gridstack';

export type GridItem = GridStackWidget;
export type GridOptions = GridStackOptions;

type EventHandler = (data?: any) => void;

export class Grid {
  private instance: GridStack | null = null;
  private el: HTMLElement | null = null;
  private items: GridItem[] = [];
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  /**
   * Initialize the GridStack instance
   * @param el The container element
   * @param options GridStack options
   */
  init(el: HTMLElement, options: GridOptions = {}) {
    this.el = el;
    this.instance = GridStack.init(options, el);
    
    // Bind GridStack events to internal event system
    this.bindGridEvents();
    
    return this;
  }

  private bindGridEvents() {
    if (!this.instance) return;

    // Listen to native gridstack events and emit them through our system
    // 'change' event provides list of changed nodes
    this.instance.on('change', (event: Event, nodes: GridStackNode[]) => {
      // Update internal state based on changes
      this.updateInternalState(nodes);
      this.emit('change', nodes);
    });

    this.instance.on('added', (event: Event, nodes: GridStackNode[]) => {
      this.updateInternalState(nodes);
      this.emit('added', nodes);
    });

    this.instance.on('removed', (event: Event, nodes: GridStackNode[]) => {
      // Removed nodes are handled, but we need to ensure our state matches
      this.removeInternalState(nodes);
      this.emit('removed', nodes);
    });

    // Other events can be forwarded directly
    ['dragstart', 'dragstop', 'resizestart', 'resizestop', 'dropped'].forEach(evt => {
      this.instance!.on(evt, (event: Event, el: any) => {
        this.emit(evt, { event, el });
      });
    });
  }

  private updateInternalState(nodes: GridStackNode[]) {
    nodes.forEach(node => {
      const existing = this.items.find(i => i.id === node.id);
      if (existing) {
        Object.assign(existing, {
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
          // Add other props if needed
        });
      } else {
        // New item
        this.items.push({
          id: node.id,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
          content: node.content,
          ...node // Copy other properties
        });
      }
    });
  }

  private removeInternalState(nodes: GridStackNode[]) {
    const idsToRemove = new Set(nodes.map(n => n.id));
    this.items = this.items.filter(i => !idsToRemove.has(i.id));
  }

  /**
   * Sync layout from external source (e.g. framework props)
   * This is the core method for data-driven updates
   * @param newLayout The desired layout state
   */
  sync(newLayout: GridItem[]) {
    if (!this.instance) return;

    // 1. Identify added items
    const currentIds = new Set(this.items.map(i => i.id));
    const addedItems = newLayout.filter(i => !currentIds.has(i.id));

    // 2. Identify removed items
    const newIds = new Set(newLayout.map(i => i.id));
    const removedItems = this.items.filter(i => !newIds.has(i.id));

    // 3. Identify updated items (moved/resized)
    // Actually, we trust GridStack to handle position if we update widgets, 
    // but if the update comes from outside (e.g. server loaded layout), we need to update GridStack.
    // However, if the update comes from Vue prop change triggered by OUR 'change' event, we should avoid loop.
    // We can assume 'sync' is called when the SOURCE of TRUTH changes.
    
    // Batch updates to avoid flicker?
    this.instance.batchUpdate();

    // Remove deleted
    removedItems.forEach(item => {
      const el = this.instance!.getGridItems().find(e => e.gridstackNode?.id === item.id);
      if (el) {
        this.instance!.removeWidget(el, true); // Remove DOM too? Or just let framework handle it?
        // If we are in a framework that handles DOM (like Vue v-for), we should NOT remove DOM here potentially?
        // BUT, GridStack needs to clear its node.
        // If we say removeDOM=false, GridStack keeps the DOM but removes node.
        // Then framework removes DOM. This is safer.
        this.instance!.removeWidget(el, false);
      }
    });

    // Add new (We just update internal state, framework handles DOM creation via v-for)
    // But GridStack needs to know about them. 
    // If framework renders DOM, we need to call makeWidget on them.
    // So 'sync' might just update data state, and let `make` be called by framework lifecycle?
    // OR we proactively add them if they are not in DOM yet?
    // In "Headless" + "Framework" mode:
    // 1. Framework renders DOM based on list.
    // 2. Framework calls `make` on new elements.
    // 3. Core `sync` updates internal list to match.
    
    // So `sync` here mainly updates the internal `items` list to match external truth,
    // AND updates properties of existing items (e.g. programmatic move).
    
    newLayout.forEach(newItem => {
      const existing = this.items.find(i => i.id === newItem.id);
      if (existing) {
        // Update properties if changed
        if (existing.x !== newItem.x || existing.y !== newItem.y || existing.w !== newItem.w || existing.h !== newItem.h) {
          const el = this.instance!.getGridItems().find(e => e.gridstackNode?.id === newItem.id);
          if (el) {
            this.instance!.update(el, { x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h });
          }
        }
        // Update internal
        Object.assign(existing, newItem);
      } else {
        // New item - we just add to internal list. 
        // Framework will render it, then call makeWidget via lifecycle hooks?
        // OR we return these as "to be created"?
        this.items.push(newItem);
      }
    });

    this.items = [...newLayout]; // Force sync reference
    
    this.instance.commit();
  }

  /**
   * Load items (Reset)
   */
  load(items: GridItem[]) {
    if (!this.instance) return;
    this.items = [...items];
    this.instance.load(items);
  }

  /**
   * Add a widget programmatically
   */
  add(item: GridItem) {
    if (!this.instance) return;
    // We add to gridstack, which triggers 'added' event, which updates internal state
    return this.instance.addWidget(item);
  }

  /**
   * Remove a widget programmatically
   */
  remove(id: string) {
    if (!this.instance) return;
    const el = this.instance.getGridItems().find(e => e.gridstackNode?.id === id);
    if (el) {
      this.instance.removeWidget(el);
    }
  }

  /**
   * Make element a widget (Framework should call this after rendering DOM)
   */
  make(el: HTMLElement) {
    if (!this.instance) return;
    return this.instance.makeWidget(el);
  }

  /**
   * Event Emitter implementation
   */
  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  /**
   * Get current items
   */
  getItems(): GridItem[] {
    // Return copy to prevent direct mutation issues? 
    // Or direct reference for reactivity? 
    // Headless usually returns snapshot or observable.
    return this.instance ? this.instance.save(false) as GridItem[] : this.items;
  }

  destroy(removeDOM: boolean = false) {
    if (!this.instance) return;
    this.instance.destroy(removeDOM);
    this.instance = null;
    this.eventHandlers.clear();
    this.items = [];
  }
}
