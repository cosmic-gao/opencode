import { createApp, h, nextTick, onMounted, ref } from "vue";
import { Grid, GridDragPortal } from "../vue";
import type { GridItemProps } from "../vue";
import type { DragItemOptions, GridItemOptions } from "../core";

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

    const log = ref<string[]>([]);
    const portalState = ref<string>("");

    const addLog = (message: string) => {
      log.value = [`[${new Date().toLocaleTimeString()}] ${message}`, ...log.value.slice(0, 9)];
    };

    const handleDropped = (node: DragItemOptions<unknown>) => {
      const data = node.data as { source?: string; type?: string } | undefined;
      addLog(`✅ Dropped: ${data?.type ?? 'unknown'} from ${data?.source ?? 'unknown'}`);
    };

    const handleRemoved = (nodes: GridItemOptions[]) => {
      nodes.forEach(node => {
        const data = node.data as { source?: string; type?: string } | undefined;
        addLog(`🗑️ Removed: ${data?.type ?? node.id ?? 'unknown'}`);
      });
    };

    let isUpdating = false;
    const handleModelUpdate = (value: GridItemProps[]) => {
      if (isUpdating) return;
      isUpdating = true;
      items.value = value;
      addLog(`📝 Layout updated: ${value.length} items`);
      // 使用 nextTick 确保更新完成后再允许下次更新
      void nextTick(() => {
        isUpdating = false;
      });
    };

    const updatePortalState = async () => {
      await nextTick();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const portals = Array.from(document.querySelectorAll(".oc-grid-drag-portal")) as Array<
        HTMLElement & { gridstackNode?: unknown }
      >;
      const readyCount = portals.filter((portal) => Boolean(portal.gridstackNode)).length;
      portalState.value = `Portal 绑定状态: ${readyCount}/${portals.length}`;
    };

    onMounted(() => {
      void updatePortalState();
      setTimeout(() => void updatePortalState(), 50);
    });

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
              { default: () => h("div", { class: "sourceCard" }, "📝 Drag: Text") }
            ),
            h(
              GridDragPortal,
              {
                target: "demo",
                w: 3,
                h: 2,
                data: { source: "portal", type: "chart" }
              },
              { default: () => h("div", { class: "sourceCard" }, "📊 Drag: Chart") }
            ),
            h(
              GridDragPortal,
              {
                target: "demo",
                w: 3,
                h: 2,
                data: { source: "portal", type: "image" }
              },
              { default: () => h("div", { class: "sourceCard" }, "🖼️ Drag: Image") }
            )
          ]),
          h("div", { class: "title", style: "margin-top:10px" }, portalState.value),
          h("h3", { class: "title", style: "margin-top:14px" }, "垃圾桶"),
          h("div", { class: ["trash", "grid-stack-library-trash"] }, "🗑️ Drop Here To Delete"),
          h("h3", { class: "title", style: "margin-top:14px" }, "事件日志"),
          h("pre", { class: "output" }, log.value.join('\n') || '等待事件...'),
          h("h3", { class: "title", style: "margin-top:14px" }, "Layout 数据"),
          h("pre", { class: "output" }, JSON.stringify(items.value, null, 2))
        ]),
        h("div", { class: "gridShell panel" }, [
          h(Grid, {
            name: "demo",
            modelValue: items.value,
            options: { float: true },
            "onUpdate:modelValue": handleModelUpdate,
            onDropped: handleDropped,
            onRemoved: handleRemoved
          })
        ])
      ]);
  }
};

createApp(app).mount("#app");
