<script setup>
import { filterToColor } from '@/utils/color'

const props = defineProps({
  filter: {
    type: String,
    required: true
  }
})

</script>
<template>
  <p
    class="filter-badge rounded d-flex pa-2 justify-center align-center prevent-select"
    :style="{ backgroundColor: filterToColor(props.filter) }"
  >
    {{ props.filter }}
  </p>
</template>
<style scoped>
.filter-badge {
  color: var(--text);
  font-size: smaller;
  font-weight: bolder;
  max-width: 2.2rem;
}
</style>
