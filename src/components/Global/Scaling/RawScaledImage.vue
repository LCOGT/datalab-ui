<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useScalingStore } from '@/stores/scaling'

// This component uses a web worker to redraw a scaled raw image when
// the scale points change

const props = defineProps({
  rawData: {
    type: Object,
    required: true
  },
  maxSize: {
    type: Number,
    default: 500
  },
  color: {
    type: Object,
    required: true
  },
  scalePoints: {
    type: Array,
    default: () => [0, 65535]
  },
  imageName: {
    type: String,
    required: true
  }
})

const scalingStore = useScalingStore()
const imageCanvas = ref(null)
var offscreen = null
// SharedArrayBuffer is used for the web worker to fill in data that will then be sent
// by the main thread to the store for the composite image preview
const sharedArrayBuffer = new SharedArrayBuffer(Uint8ClampedArray.BYTES_PER_ELEMENT * props.maxSize * props.maxSize)
var sharedArray = new Uint8ClampedArray(sharedArrayBuffer)
const worker = new Worker('drawImageWorker.js')
const isCanvasReady = ref(false)

onMounted(() => {
  // Seed the web worker with initial data including a reference to the offscreen canvas
  offscreen = imageCanvas.value.transferControlToOffscreen()
  worker.postMessage({canvas: offscreen, width: props.maxSize, height: props.maxSize, sharedArrayBuffer: sharedArrayBuffer}, [offscreen])

  // If we are storing color channels for a composite image preview, set a callback
  // for the web-worker to extract that data from the shared array and send to the store
  worker.onmessage = () => {
    scalingStore.updateImageArray(props.color, sharedArray, props.maxSize)
    isCanvasReady.value = true
  }
})

onUnmounted(() => {
  worker.terminate()
})

watch(
  () => props.scalePoints, () => {
    // This triggers the web worker to recompute and redraw the scaled image to screen
    worker.postMessage({ scalePoints: structuredClone(props.scalePoints)})
  },
  { immediate: false }
)

watch(
  () => props.rawData, () => {
    // This should only be called once, but might not happen when component is created
    if (props.rawData) {
      worker.postMessage({imageData: structuredClone(props.rawData)})
    }
  },
  { immediate: false }
)

</script>
<template>
  <div class="position-relative">
    <canvas
      ref="imageCanvas"
      :width="props.maxSize"
      :height="props.maxSize"
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
  width: 200px;
  height: 200px;
}
.v-progress-circular {
  position: absolute;
  top: 35%;
  right: 25%;
}
</style>
