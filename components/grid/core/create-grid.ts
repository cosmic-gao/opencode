import { type GridEngineOptions } from "./grid-engine";
import { GridFactory } from "./grid-factory";

export interface GridOptions extends GridEngineOptions {
}

export function createGrid(els: string | HTMLElement, options?: GridOptions) {
  const instance = GridFactory.getInstance()
  return instance.createGrid(els, options)
}
