import type { GridItemHTMLElement, GridStack, GridStackNode } from "gridstack";

declare module "gridstack" {
  interface GridStackNode {
    _isExternal?: boolean;
  }

  interface GridItemHTMLElement {
    _gridstackNodeOrig?: GridStackNode;
  }

  interface GridStack {
    placeholder: GridItemHTMLElement;
    _isTemp?: boolean;
  }
}

