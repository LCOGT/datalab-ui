<script setup>
import { ref, computed, watch, onMounted } from 'vue'
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
  },
  imageName: {
    type: String,
    required: true
  }
})

const scalingStore = useScalingStore()
const imageCanvas = ref(null)
var context = null

const ableToDraw = computed(() => { return scalingStore.compositeImageData })

function redrawImage() {
  if (ableToDraw.value) {
    const compositeImage = scalingStore.compositeImageData
    // convert to ImageBitMap to use drawImage
    createImageBitmap(compositeImage).then((compositeImageBitMap) => {
      // scale image to fit canvas
      context.drawImage(compositeImageBitMap, 0, 0, compositeImageBitMap.width, compositeImageBitMap.height, 0, 0, props.width, props.height)
    })
  }
}

onMounted(() => {
  context = imageCanvas.value.getContext('2d')
})

watch(() => scalingStore.compositeImageData, () => { redrawImage() })

</script>
<template>
  <canvas
    ref="imageCanvas"
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
