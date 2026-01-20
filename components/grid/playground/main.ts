import "gridstack/dist/gridstack.min.css";
import { createApp, h, ref } from "vue";
import { Grid } from "../vue";

const app = {
  setup() {
    const items = ref([
      { id: "a", x: 0, y: 0, w: 3, h: 2 },
      { id: "b", x: 3, y: 0, w: 3, h: 2 }
    ]);

    return () =>
      h("div", { style: "padding:16px" }, [
        h(Grid, {
          name: "demo",
          modelValue: items.value,
          "onUpdate:modelValue": (value: unknown) => {
            items.value = value as typeof items.value;
          }
        })
      ]);
  }
};

createApp(app).mount("#app");
