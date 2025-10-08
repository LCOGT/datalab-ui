<script setup>
import { filterToColor } from '@/utils/common'

/*
  This component displays a badge for a given filter name. Added to images in ImageGrid.vue.
  The background color of the badge is determined by the filter name using the filterToColor utility function.
*/

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
