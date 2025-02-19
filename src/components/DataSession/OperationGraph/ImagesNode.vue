<script setup>
import ImageGrid from '@/components/Global/ImageGrid.vue'
import { calculateColumnSpan } from '@/utils/common'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
})

const imagesPerRow = 6

</script>

<template>
  <image-grid
    :images="props.data.images"
    :column-span="calculateColumnSpan(props.data.images.length, data.imagesPerRow || imagesPerRow)"
  />
</template>

<style scoped>
</style>
