import {
    type DDElementHost,
    type GridHTMLElement,
    type GridItemHTMLElement,
    type GridStackOptions,
    type GridStackDroppedHandler,
    type GridStackEventHandler,
    type GridStackNodesHandler,
    type GridStackElementHandler,
    type GridStackNode,
    GridStack as GridStackNative
} from 'gridstack';

export interface GridStackEvent {
    dropped: GridStackDroppedHandler;
    enable: GridStackEventHandler;
    disable: GridStackEventHandler;
    change: GridStackNodesHandler;
    added: GridStackNodesHandler;
    removed: GridStackNodesHandler;
    resizecontent: GridStackNodesHandler;
    resizestart: GridStackElementHandler;
    resize: GridStackElementHandler;
    resizestop: GridStackElementHandler;
    dragstart: GridStackElementHandler;
    drag: GridStackElementHandler;
    dragstop: GridStackElementHandler;
}

export interface GridStack extends GridStackNative {
    placeholder: GridItemHTMLElement;
    _isTemp?: boolean;
    _gsEventHandler: Partial<{
        [K in keyof GridStackEvent]: GridStackEvent[K];
    }>;
    _removeDD(el: DDElementHost): GridStack;
    _triggerChangeEvent(): GridStack;
    _triggerRemoveEvent(): GridStack;
    _readAttr(el: HTMLElement, clearDefaultAttr?: boolean): GridStackNode;
    _leave(el: GridItemHTMLElement, helper?: GridItemHTMLElement): void;
    _updateContainerHeight(): GridStack;
}

export class GridStack extends GridStackNative {
    public constructor(el: GridHTMLElement, opts: GridStackOptions = {}) {
        super(el, opts);
    }
}
