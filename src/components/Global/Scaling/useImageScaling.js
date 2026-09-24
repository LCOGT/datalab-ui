import { computed, markRaw, onUnmounted, ref } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { fetchApiCall } from '@/utils/api'
import { loadImage } from '@/utils/common'

const MAX_IMAGE_DIMENSION = 1024

function useImageScaling() {
  const configStore = useConfigurationStore()
  const rawData = ref(null)
  const zmin = ref(null)
  const zmax = ref(null)
  const imageWidth = ref(null)
  const imageHeight = ref(null)
  const imageScaleLoading = ref(false)
  const scalerReady = ref(false)
  const scaledImageUrl = ref('')
  let worker = null
  let workerProcessing = false
  let nextScale = null
  let objectUrl = ''

  const imageScaleReady = computed(() => imageWidth.value && imageHeight.value && rawData.value && zmin.value != null && zmax.value != null)
  const histogram = computed(() => rawData.value.histogram)
  const bins = computed(() => rawData.value.bins)
  const maxPixelValue = computed(() => Math.pow(2, rawData.value.bitdepth) - 1)

  async function loadScaledImage(image, imageUrl) {
    resetImageScaling()
    imageScaleLoading.value = true
    await loadImageDimensions(imageUrl)
    await loadRawData(image)
    createWorker()
    imageScaleLoading.value = false
  }

  function resetImageScaling() {
    terminateWorker()
    rawData.value = null
    zmin.value = null
    zmax.value = null
    imageWidth.value = null
    imageHeight.value = null
    imageScaleLoading.value = false
    workerProcessing = false
    nextScale = null
  }

  async function loadImageDimensions(url) {
    const img = await loadImage(url)
    imageWidth.value = Math.min(img.width, MAX_IMAGE_DIMENSION)
    imageHeight.value = Math.min(img.height, MAX_IMAGE_DIMENSION)
  }

  async function loadRawData(image) {
    const response = await fetchApiCall({
      url: configStore.datalabApiBaseUrl + 'analysis/raw-data/',
      method: 'POST',
      body: {
        basename: image.basename,
        source: image.source,
        max_size: Math.min(imageWidth.value, imageHeight.value),
      },
    })

    response.data = markRaw(response.data)
    rawData.value = response
    zmin.value = response.zmin
    zmax.value = response.zmax
  }

  function createWorker() {
    worker = new Worker('drawImageWorker.js')
    const canvas = document.createElement('canvas')
    canvas.width = imageWidth.value
    canvas.height = imageHeight.value
    const offscreen = canvas.transferControlToOffscreen()

    worker.onmessage = handleWorkerMessage
    worker.postMessage({
      canvas: offscreen,
      imageData: JSON.parse(JSON.stringify(rawData.value)),
    }, [offscreen])
    scalerReady.value = true
  }

  function updateScaling(min, max) {
    nextScale = [min, max]
    processNextScale()
  }

  function processNextScale() {
    if (!nextScale || workerProcessing || !worker) return

    workerProcessing = true
    worker.postMessage({ scalePoints: [...nextScale] })
    nextScale = null
  }

  function handleWorkerMessage(event) {
    workerProcessing = false

    if (event.data.blob) {
      updateScaledImageUrl(event.data.blob)
    }

    processNextScale()
  }

  function updateScaledImageUrl(blob) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }

    objectUrl = URL.createObjectURL(blob)
    scaledImageUrl.value = objectUrl
  }

  function terminateWorker() {
    worker?.terminate()
    worker = null
    scalerReady.value = false

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = ''
      scaledImageUrl.value = ''
    }
  }

  onUnmounted(resetImageScaling)

  return {
    rawData,
    zmin,
    zmax,
    imageScaleLoading,
    scalerReady,
    scaledImageUrl,
    imageScaleReady,
    histogram,
    bins,
    maxPixelValue,
    loadScaledImage,
    resetImageScaling,
    updateScaling,
  }
}

export { useImageScaling }
