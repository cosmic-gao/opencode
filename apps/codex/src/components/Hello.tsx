import { defineComponent } from 'vue'

export default defineComponent({
  name: 'Hello',
  props: {
    msg: { type: String, required: true }
  },
  setup(props) {
    return () => (
      <h2 class="text-xl font-semibold">{ props.msg }</h2>
    )
  }
})

