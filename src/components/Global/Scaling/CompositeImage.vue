<script setup>
import { ref, defineProps, computed, watch, onMounted } from 'vue'
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
const isLoading = ref(false) // not being used yet
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
    :width="props.width"
    :height="props.height"
  />
  <v-progress-circular
    v-show="isLoading"
    color="primary"
    size="200"
    indeterminate
  />
</template>
<style scoped>
.v-progress-circular {
  position:fixed;
  bottom: 40%;
  left: 60%;
}
</style>
