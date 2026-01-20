import { GridItem } from './types';

export class Layout {
  private _items: GridItem[] = [];

  get items(): GridItem[] {
    return this._items;
  }

  set items(value: GridItem[]) {
    this._items = [...value];
  }

  load(items: GridItem[]) {
    this._items = [...items];
  }

  find(id: string): GridItem | undefined {
    return this._items.find(i => i.id === id);
  }

  add(item: GridItem) {
    if (!this.find(item.id!)) {
      this._items.push(item);
    }
  }

  remove(id: string) {
    this._items = this._items.filter(i => i.id !== id);
  }

  update(item: Partial<GridItem> & { id: string }) {
    const idx = this._items.findIndex(i => i.id === item.id);
    if (idx > -1) {
      this._items[idx] = { ...this._items[idx], ...item };
    } else {
        // Optional: Add if not found? 
        // For now, assume update only updates existing
    }
  }
}
