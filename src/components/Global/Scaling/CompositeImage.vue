<script setup>
import { ref, watch, onMounted } from 'vue'
import { useScalingStore } from '@/stores/scaling'

// This component draws a composite RGB image from the scaling store

const props = defineProps({
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  }
})

const scalingStore = useScalingStore()
const compositeImageCanvas = ref(null)
var context = null

function redrawImage() {
  if (!scalingStore.compositeImageData || !context) return

  // convert to ImageBitMap to use drawImage
  createImageBitmap(scalingStore.compositeImageData).then((compositeImageBitMap) => {
    // scale image to fit canvas
    context.drawImage(compositeImageBitMap, 0, 0, compositeImageBitMap.width, compositeImageBitMap.height, 0, 0, props.width, props.height)
    compositeImageBitMap.close()
  })
}

onMounted(() => { 
  context = compositeImageCanvas.value.getContext('2d')
  redrawImage()
})

watch(() => scalingStore.compositeImageData, redrawImage)

</script>
<template>
  <canvas
    ref="compositeImageCanvas"
    class="composite-canvas elevation-8 rounded-md"
    :width="props.width"
    :height="props.height"
  />
</template>
<style scoped>
.composite-canvas{
  background-color: var(--card-background);
}
</style>
