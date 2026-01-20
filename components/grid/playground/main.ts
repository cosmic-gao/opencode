import { createApp, h, ref } from "vue";
import { Grid, GridDragPortal } from "../vue";
import type { GridItemProps } from "../vue";

const app = {
  setup() {
    const items = ref<GridItemProps[]>([
      {
        id: "group",
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        children: [
          { id: "g1", x: 0, y: 0, w: 3, h: 2, data: { source: "nested", type: "chart" } },
          { id: "g2", x: 3, y: 0, w: 3, h: 2, data: { source: "nested", type: "table" } }
        ]
      },
      { id: "a", x: 6, y: 0, w: 3, h: 2, data: { source: "main", type: "text" } },
      { id: "b", x: 9, y: 0, w: 3, h: 2, data: { source: "main", type: "image" } }
    ]);

    return () =>
      h("div", { class: "page" }, [
        h("div", { class: "panel" }, [
          h("h3", { class: "title" }, "外部拖拽源"),
          h("div", { class: "sourceList" }, [
            h(
              GridDragPortal,
              {
                target: "demo",
                w: 3,
                h: 2,
                data: { source: "portal", type: "text" }
              },
              { default: () => h("div", { class: "sourceCard" }, "Drag: Text") }
            ),
            h(
              GridDragPortal,
              {
                target: "demo",
                w: 3,
                h: 2,
                data: { source: "portal", type: "chart" }
              },
              { default: () => h("div", { class: "sourceCard" }, "Drag: Chart") }
            ),
            h(
              GridDragPortal,
              {
                target: "group:nested",
                w: 3,
                h: 2,
                data: { source: "portal", type: "nested" }
              },
              { default: () => h("div", { class: "sourceCard" }, "Drag: To Nested") }
            )
          ]),
          h("h3", { class: "title", style: "margin-top:14px" }, "垃圾桶"),
          h("div", { class: ["trash", "grid-stack-library-trash"] }, "Drop Here To Delete"),
          h("h3", { class: "title", style: "margin-top:14px" }, "layout 输出"),
          h("pre", { class: "output" }, JSON.stringify(items.value, null, 2))
        ]),
        h("div", { class: "gridShell panel" }, [
          h(Grid, {
            name: "demo",
            modelValue: items.value,
            options: { float: true },
            "onUpdate:modelValue": (value: GridItemProps[]) => {
              items.value = value;
            },
            onDropped: (node: unknown) => {
              void node;
            }
          })
        ])
      ]);
  }
};

createApp(app).mount("#app");
