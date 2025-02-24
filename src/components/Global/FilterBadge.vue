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
    class="filter-badge"
    :style="{ backgroundColor: filterToColor(props.filter) }"
  >
    {{ props.filter }}
  </p>
</template>
<style scoped>
.filter-badge {
  border-radius: 10px;
  color: var(--tan);
  padding: 6px 10px;
  display: inline-block;
  user-select: none;
  font-size: smaller;
  font-weight: bolder;
  color: var(--off-white);
}
</style>
