import {
  type DDGridStack,
  type GridItemHTMLElement,
  type GridStackNode,
  DDElement,
} from "gridstack";
import { type DragItemOptions, GridEngine } from "./grid-engine";
import { GridStack } from "./grid-stack";

export class DragEngine<T = unknown> {
  private readonly grid: GridEngine<T>;

  public constructor(grid: GridEngine<T>) {
    this.grid = grid;
  }

  /**
   * 销毁元素的拖拽功能
   * @param element 要销毁拖拽功能的元素
   * @returns DDGridStack 实例
   */
  public destroyDragIn(element: HTMLElement): DDGridStack {
    return GridStack.getDD().draggable(element, 'destroy');
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
  public setupDragIn(element: HTMLElement, item: DragItemOptions<T>, helper?: 'clone' | ((el: HTMLElement) => HTMLElement)) {
    const ddElement = DDElement.init(element);
    (element as GridItemHTMLElement).gridstackNode = item as unknown as GridStackNode;

    const dragOptions = {
      ...this.grid.options.dragInOptions,
      helper: helper ?? this.grid.options.dragInOptions?.helper,
      handle: this.grid.options.handle
    };
    ddElement.setupDraggable(dragOptions);
  }
}
