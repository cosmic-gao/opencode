import type { GridItemHTMLElement, GridStackNode } from "gridstack";
import type { GridStack } from "./grid-stack";

export function readNode(grid: GridStack, el: GridItemHTMLElement): GridStackNode | undefined {
  const node = (el.gridstackNode as GridStackNode | undefined) ?? undefined;
  const readAttr = (grid as unknown as { _readAttr?: (el: HTMLElement, clear?: boolean) => GridStackNode })._readAttr;
  return readAttr ? (node ?? readAttr(el, false)) : node;
}

export function leaveGrid(grid: GridStack, el: GridItemHTMLElement, helper?: GridItemHTMLElement): void {
  const leave = (grid as unknown as { _leave?: (el: GridItemHTMLElement, helper?: GridItemHTMLElement) => void })._leave;
  leave?.(el, helper);
}

export function removeDrag(grid: GridStack, el: HTMLElement): void {
  const removeDD = (grid as unknown as { _removeDD?: (el: any) => void })._removeDD;
  removeDD?.(el as any);
}

export function updateHeight(grid: GridStack): void {
  const updateContainerHeight = (grid as unknown as { _updateContainerHeight?: () => void })._updateContainerHeight;
  updateContainerHeight?.();
}

export function triggerChange(grid: GridStack): void {
  const triggerChangeEvent = (grid as unknown as { _triggerChangeEvent?: () => void })._triggerChangeEvent;
  triggerChangeEvent?.();
}
