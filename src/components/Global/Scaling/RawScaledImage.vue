<script setup>
import { ref, defineProps, watch, onMounted } from 'vue'
import { useScalingStore } from '@/stores/scaling'
import _ from 'lodash'

// This component uses a web worker to redraw a scaled raw image when
// the scale points change

const props = defineProps({
  imageData: {
    type: Object,
    required: true
  },
  maxSize: {
    type: Number,
    default: 500
  },
  filter: {
    type: String,
    required: true
  },
  scalePoints: {
    type: Array,
    default: () => [0, 65535]
  },
  imageName: {
    type: String,
    required: true
  },
  compositeName: {
    type: String,
    required: true
  }
})

const store = useScalingStore()
const imageCanvas = ref(null)
var offscreen = null
// SharedArrayBuffer is used for the web worker to fill in data that will then be sent
// by the main thread to the store for the composite image preview
const sharedArrayBuffer = new SharedArrayBuffer(Uint8ClampedArray.BYTES_PER_ELEMENT * props.maxSize * props.maxSize)
var sharedArray = new Uint8ClampedArray(sharedArrayBuffer)
const worker = new Worker('drawImageWorker.js')

onMounted(() => {
  // Seed the web worker with initial data including a reference to the offscreen canvas
  offscreen = imageCanvas.value.transferControlToOffscreen()
  worker.postMessage({canvas: offscreen, width: props.maxSize, height: props.maxSize, sharedArrayBuffer: sharedArrayBuffer}, [offscreen])

  // If we are storing color channels for a composite image preview, set a callback
  // for the web-worker to extract that data from the shared array and send to the store
  if (props.compositeName != 'default') {
    worker.onmessage = () => {
      store.updateImageArray(props.compositeName, props.filter, sharedArray, props.maxSize)
    }
  }
 

})

watch(
  () => props.scalePoints, () => {
    // This triggers the web worker to recompute and redraw the scaled image to screen
    worker.postMessage({scalePoints: _.cloneDeep(props.scalePoints)})
  },
  { immediate: false }
)

watch(
  () => props.imageData, () => {
    // This should only be called once, but might not happen when component is created
    if (props.imageData) {
      worker.postMessage({imageData: _.cloneDeep(props.imageData)})
    }
  },
  { immediate: false }
)

</script>
<template>
  <canvas
    ref="imageCanvas"
    class="raw-scaled-canvas"
    :width="props.maxSize"
    :height="props.maxSize"
  />
</template>
<style scoped>
.raw-scaled-canvas{
  width: 200px;
  height: 200px;
}
</style>
