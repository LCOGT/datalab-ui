<script setup>
import { ref, computed, onMounted } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { fetchApiCall } from '@/utils/api'
import RawScaledImage from './RawScaledImage.vue'
import HistogramSlider from './HistogramSlider.vue'

// This component gets the raw image data from the server for an image
// and then displays the image and the scaling controls under it

const props = defineProps({
  image: {
    type: Object,
    required: true
  },
  color: {
    type: Object,
    required: true
  },
  channelIndex: {
    type: Number,
    required: true
  },
  maxSize: {
    type: Number,
    default: 700 // Determines the resolution of the RGB image and preview images
  }
})

const emit = defineEmits(['updateScaling'])
const store = useConfigurationStore()
const dataSessionsUrl = store.datalabApiBaseUrl
const errorReason = ref('')
const rawData = ref({})
const sliderRange = ref([0, 65535])
const zScaleValues = ref([0, 65535])

const maxPixelValue = computed(() => {
  if (rawData.value && rawData.value.bitdepth) {
    return Math.pow(2, rawData.value.bitdepth) - 1
  }
  else {
    // Assume 16 bit depth to start as default
    return 65535
  }
})

const histogram = computed(() => {
  if (rawData.value && rawData.value.histogram) {
    return rawData.value.histogram
  }
  else {
    return [0, 10, 10, 5, 4, 3, 2, 1]
  }
})

const bins = computed(() => {
  if (rawData.value && rawData.value.bins) {
    return rawData.value.bins
  }
  else {
    return [0, 1, 2, 3, 4, 5, 6, 7]
  }
})

function updateScaleRange(lowerValue, upperValue) {
  sliderRange.value = [Number(lowerValue), Number(upperValue)]
  emit('updateScaling', props.channelIndex, sliderRange.value[0], sliderRange.value[1])
}

function fetchRawData(){
  const url = dataSessionsUrl + 'analysis/raw-data/'
  const body = {
    'basename': props.image.basename,
    'source': props.image.source,
    'max_size': props.maxSize
  }
  fetchApiCall({url: url, method: 'POST', body: body,
    successCallback: (response) => {
      rawData.value = response
      zScaleValues.value = [response.zmin, response.zmax]
    },
    failCallback: (error) => {
      errorReason.value = error
      console.error('API call failed with error:', error)
    }
  })
}

onMounted(async () => {
  const readyToDrawHistogram = rawData.value && zScaleValues.value[0] && zScaleValues.value[1]
  if(!readyToDrawHistogram){
    await fetchRawData()
  }
})

</script>
<template>
  <div class="image-scaler d-flex ga-4 align-center justify-center pa-2 rounded-lg">
    <raw-scaled-image
      :max-size="props.maxSize"
      :raw-data="rawData"
      :scale-points="sliderRange"
      :color="color"
      :image-name="image.basename"
    />
    <histogram-slider
      :color="color"
      :histogram="histogram"
      :bins="bins"
      :max-value="maxPixelValue"
      :z-min="zScaleValues[0]"
      :z-max="zScaleValues[1]"
      @update-scaling="updateScaleRange"
    />
  </div>
</template>
<style scoped>
.image-scaler {
  background-color: var(--card-background);
}

</style>
