<script setup>
import { filterToColor } from '@/utils/common'

const props = defineProps({
  filter: {
    type: String,
    required: true
  }
})

</script>
<template>
  <p
    class="filter-badge rounded d-flex pa-2 justify-center align-center"
    :style="{ backgroundColor: filterToColor(props.filter) }"
  >
    {{ props.filter }}
  </p>
</template>
<style scoped>
.filter-badge {
  color: var(--text);
  user-select: none;
  font-size: smaller;
  font-weight: bolder;
  max-width: 2.2rem;
}
</style>
