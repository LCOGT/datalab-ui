<script setup>
import { ref, watch, onMounted, onUnmounted, toRaw } from 'vue'
import { useScalingStore } from '@/stores/scaling'

// This component uses a web worker to redraw a scaled composite image when
// the scale points of component images change

const props = defineProps({
  width: {
    type: Number,
    default: 500
  },
  height: {
    type: Number,
    default: 500
  }
})

const scalingStore = useScalingStore()
const imageCanvas = ref(null)
var offscreen = null
const worker = new Worker('drawCompositeWorker.js')
const isInitialized = ref(false)
const isCanvasReady = ref(false)
const isDrawing = ref(false)

onMounted(() => {
  // Seed the web worker with initial data including a reference to the offscreen canvas
  offscreen = imageCanvas.value.transferControlToOffscreen()
})

function initializeWorker() {
  worker.postMessage({canvas: offscreen, width: props.width, height: props.height, sharedArrayBuffers: toRaw(scalingStore.sharedArrayBuffers), colors: toRaw(scalingStore.colors)}, [offscreen])
  isInitialized.value = true
  // Just want to know when it has drawn the first time to show the image
  worker.onmessage = () => {
    isDrawing.value = false
    isCanvasReady.value = true
  }
}

onUnmounted(() => {
  worker.terminate()
})

watch(
  () => scalingStore.readyToBegin, () => {
    if (!isInitialized.value && scalingStore.readyToBegin) {
      initializeWorker()
    }
  }
)

watch(
  () => scalingStore.readyToUpdate, () => {
    if (toRaw(scalingStore.readyToUpdate).some(val => val === true)) {
      // This triggers the web worker to recompute and redraw the composite image to screen
      if (isDrawing.value === false) {
        isDrawing.value = true
        worker.postMessage({ indicesChanged: toRaw(scalingStore.readyToUpdate)})
      }
      scalingStore.clearReadyToUpdate()
    }
  },
  { immediate: false, deep: true }
)

</script>
<template>
  <div class="position-relative">
    <canvas
      ref="imageCanvas"
      :width="props.width"
      :height="props.height"
    />
    <v-progress-circular
      v-if="!isCanvasReady"
      color="var(--success)"
      indeterminate
      :size="80"
      :width="10"
    />
  </div>
</template>
<style scoped>
canvas{
  width: 500px;
  height: 500px;
}
.v-progress-circular {
  position: absolute;
  top: 35%;
  right: 25%;
}
</style>
