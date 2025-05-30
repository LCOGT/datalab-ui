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

const store = useScalingStore()
const imageCanvas = ref(null)
var context = null

const ableToDraw = computed(() => {
  return (store.scaledImageArrays[props.imageName] && store.scaledImageArrays[props.imageName].combined)
})

function redrawImage() {
  if (ableToDraw.value) {
    const compositeImage = store.scaledImageArrays[props.imageName].combined
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

watch(
  () => store.arrayChanged[props.imageName], () => {
    // Triggering on this arrayChanged trigger variable is so we avoid trying
    // to redraw until the image array is done being modified
    redrawImage()
  },
  { deep: true }
)

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
