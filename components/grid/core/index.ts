import { Layout } from './layout';
import { Widget } from './widget';
import createMitt, { Emitter } from '@opencode/signal';
import { GridItem, GridOptions } from './types';
import { GridStackNode } from 'gridstack';

export * from './types';
export * from './layout';
export * from './widget';

type GridEvents = {
  'change': GridItem[];
  'added': GridItem[];
  'removed': GridItem[];
  [key: string]: any;
};

export class Grid {
  public layout: Layout;
  public widget: Widget;
  public events: Emitter<GridEvents>;

  constructor() {
    this.layout = new Layout();
    this.widget = new Widget();
    this.events = createMitt<GridEvents>();

    this.bindInternalEvents();
  }

  private bindInternalEvents() {
    // Widget -> Layout -> External
    this.widget.emitter.on('change', (nodes: GridStackNode[]) => {
      nodes.forEach(node => {
        this.layout.update({
          id: node.id!,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h
        });
      });
      this.events.emit('change', this.layout.items);
    });

    this.widget.emitter.on('added', (nodes: GridStackNode[]) => {
      nodes.forEach(node => {
        // Convert GridStackNode to GridItem structure if needed
        this.layout.add({
            id: node.id,
            x: node.x, 
            y: node.y,
            w: node.w,
            h: node.h,
            // ... content?
            ...node
        });
      });
      this.events.emit('added', this.layout.items);
    });

    this.widget.emitter.on('removed', (nodes: GridStackNode[]) => {
      nodes.forEach(node => {
        if (node.id) this.layout.remove(node.id);
      });
      this.events.emit('removed', this.layout.items);
    });

    // Forward other events
    this.widget.emitter.on('*', (type, event) => {
        if (type !== 'change' && type !== 'added' && type !== 'removed') {
             // @ts-ignore
            this.events.emit(type, event);
        }
    });
  }

  init(el: HTMLElement, options: GridOptions = {}) {
    this.widget.init(el, options);
    return this;
  }

  sync(newLayout: GridItem[]) {
    // 1. Update Layout state
    this.layout.items = newLayout;
    // 2. Sync Widget
    this.widget.sync(newLayout);
  }

  load(items: GridItem[]) {
    this.layout.load(items);
    this.widget.load(items);
  }

  getItems(): GridItem[] {
    return this.layout.items;
  }

  make(el: HTMLElement) {
    return this.widget.make(el);
  }

  destroy(removeDOM: boolean = false) {
    this.widget.destroy(removeDOM);
    this.events.all.clear();
  }
  
  // Expose on/off/emit for backward compatibility or direct usage
  on<Key extends keyof GridEvents>(type: Key, handler: (event: GridEvents[Key]) => void) {
      this.events.on(type, handler);
  }
  
  off<Key extends keyof GridEvents>(type: Key, handler?: (event: GridEvents[Key]) => void) {
      this.events.off(type, handler);
  }
}
