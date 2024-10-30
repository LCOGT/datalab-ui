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
// This isn't currently used by can be used to trigger showing a spinning circular
// loading icon over the image if we add a debounce to the redraw in the future
const isLoading = ref(false)
const imageCanvas = ref(null)
var context = null

const ableToDraw = computed(() => {
  return (store.scaledImageArrays[props.imageName] && store.scaledImageArrays[props.imageName].combined)
})

function redrawImage() {
  if (ableToDraw.value) {
    context.putImageData(store.scaledImageArrays[props.imageName].combined, 0, 0)
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
  <div class="image-container mt-4" :id="'image-container-' + imageName" :style="'max-width: ' + props.width">
    <canvas ref="imageCanvas" :width="props.width" :height="props.height">
    </canvas>
    <v-progress-circular v-show="isLoading" color="primary" size="200" indeterminate></v-progress-circular>
  </div>
</template>
<style scoped>

.v-progress-circular {
  position:fixed;
  bottom: 40%;
  left: 60%;
}

</style>
