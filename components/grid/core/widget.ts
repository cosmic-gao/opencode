import { GridStack, GridStackNode } from 'gridstack';
import { GridItem, GridOptions } from './types';
import createMitt, { Emitter } from '@opencode/signal';

type WidgetEvents = {
  'change': GridStackNode[];
  'added': GridStackNode[];
  'removed': GridStackNode[];
  'dragstart': { event: Event; el: HTMLElement };
  'dragstop': { event: Event; el: HTMLElement };
  'resizestart': { event: Event; el: HTMLElement };
  'resizestop': { event: Event; el: HTMLElement };
  'dropped': { event: Event; el: HTMLElement };
  [key: string]: any;
};

export class Widget {
  private instance: GridStack | null = null;
  public emitter: Emitter<WidgetEvents>;

  constructor() {
    this.emitter = createMitt<WidgetEvents>();
  }

  init(el: HTMLElement, options: GridOptions = {}) {
    this.instance = GridStack.init(options, el);
    this.bindEvents();
    return this;
  }

  private bindEvents() {
    if (!this.instance) return;

    this.instance.on('change', (event: Event, nodes: GridStackNode[]) => {
      this.emitter.emit('change', nodes);
    });

    this.instance.on('added', (event: Event, nodes: GridStackNode[]) => {
      this.emitter.emit('added', nodes);
    });

    this.instance.on('removed', (event: Event, nodes: GridStackNode[]) => {
      this.emitter.emit('removed', nodes);
    });

    ['dragstart', 'dragstop', 'resizestart', 'resizestop', 'dropped'].forEach(evt => {
      this.instance!.on(evt, (event: Event, el: any) => {
        // @ts-ignore
        this.emitter.emit(evt, { event, el });
      });
    });
  }

  load(items: GridItem[]) {
    this.instance?.load(items);
  }

  getItems(): GridItem[] {
    return this.instance ? (this.instance.save(false) as GridItem[]) : [];
  }

  getGridItems(): GridStackNode[] {
      // GridStack's getGridItems returns HTMLElement[] usually, or GridStackNode[] depending on version/usage
      // Actually instance.getGridItems() returns GridItemHTMLElement[]
      // We want the nodes to check IDs.
      return this.instance?.getGridItems().map(el => el.gridstackNode!).filter(Boolean) || [];
  }

  sync(newLayout: GridItem[]) {
    if (!this.instance) return;

    const currentItems = this.getGridItems();
    const currentIds = new Set(currentItems.map(i => i.id));
    const newIds = new Set(newLayout.map(i => i.id));

    // 1. Remove deleted
    const removedItems = currentItems.filter(i => !newIds.has(i.id));
    this.instance.batchUpdate();
    removedItems.forEach(item => {
      const el = this.instance!.getGridItems().find(e => e.gridstackNode?.id === item.id);
      if (el) {
        // false = keep DOM (let framework handle it), true = remove DOM
        // If we are syncing from framework, we might want framework to remove DOM.
        // But GridStack needs to detach.
        this.instance!.removeWidget(el, false); 
      }
    });

    // 2. Add new / Update existing
    newLayout.forEach(newItem => {
      const existing = currentItems.find(i => i.id === newItem.id);
      if (existing) {
        // Update properties
        if (
          existing.x !== newItem.x ||
          existing.y !== newItem.y ||
          existing.w !== newItem.w ||
          existing.h !== newItem.h
        ) {
          const el = this.instance!.getGridItems().find(e => e.gridstackNode?.id === newItem.id);
          if (el) {
            this.instance!.update(el, {
              x: newItem.x,
              y: newItem.y,
              w: newItem.w,
              h: newItem.h
            });
          }
        }
      } else {
        // New item. 
        // If it's a new item from data, it might not be in DOM yet.
        // If framework renders it, we call makeWidget later.
        // If we are just updating data, we do nothing here regarding DOM creation.
        // But GridStack might need to know?
        // Usually, we wait for 'make' to be called for new DOM elements.
      }
    });

    this.instance.commit();
  }

  add(item: GridItem) {
    return this.instance?.addWidget(item);
  }

  remove(id: string) {
    const el = this.instance?.getGridItems().find(e => e.gridstackNode?.id === id);
    if (el) {
      this.instance?.removeWidget(el);
    }
  }

  make(el: HTMLElement) {
    return this.instance?.makeWidget(el);
  }

  destroy(removeDOM: boolean = false) {
    this.instance?.destroy(removeDOM);
    this.instance = null;
  }
}
