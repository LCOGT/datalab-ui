<script setup>
import { ref, computed, onMounted, defineEmits, defineProps } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { fetchApiCall } from '@/utils/api'
import RawScaledImage from './RawScaledImage.vue'

// This component gets the raw image data from the server for an image
// and then displays the image and the scaling controls under it

const props = defineProps({
  image: {
    type: Object,
    required: true
  },
  maxSize: {
    type: Number,
    default: 500
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

const emit = defineEmits(['updateScaling'])
const store = useConfigurationStore()
const dataSessionsUrl = store.datalabApiBaseUrl
const isLoading = ref(true)
const errorReason = ref('')
const rawData = ref({})
const sliderRange = ref([0, 65535])
var zScaleValues = null

const titleText = computed(() => {
  return props.imageName.replace('_', ' ')
})

function updateLowerScale(value) {
  sliderRange.value = [Number(value), sliderRange.value[1]]
  emit('updateScaling', props.imageName, sliderRange.value[0], sliderRange.value[1])
}

function updateUpperScale(value) {
  sliderRange.value = [sliderRange.value[0], Number(value)]
  emit('updateScaling', props.imageName, sliderRange.value[0], sliderRange.value[1])
}

function zScaleImage() {
  if (zScaleValues){
    sliderRange.value = [...zScaleValues]
  }
  emit('updateScaling', props.imageName, sliderRange.value[0], sliderRange.value[1])
}


onMounted(async () => {
  const url = dataSessionsUrl + 'analysis/raw-data/'
  const body = {
    'basename': props.image.basename,
    'source': props.image.source,
    'max_size': props.maxSize
  }
  fetchApiCall({url: url, method: 'POST', body: body,
    successCallback: (response) => {
      rawData.value = response
      zScaleValues = [response.zmin, response.zmax]
      zScaleImage()
      isLoading.value = false
    },
    failCallback: (error) => {
      isLoading.value = false
      errorReason.value = error
      console.error('API call failed with error:', error)
    }
  })
})

</script>
<template>
  <div :style="'max-width: ' + props.maxSize">
    <v-row class="mt-4">
      <h3 class="image-scale-title">Adjust Scaling for <span class="text-capitalize">{{ titleText }}</span></h3>
    </v-row>
    <v-row class="mt-1">
      <raw-scaled-image
        :image-data="rawData"
        :scale-points="sliderRange"
        :filter="props.image.filter"
        :image-name="props.imageName"
        :composite-name="props.compositeName"
      >
      </raw-scaled-image>
    </v-row>
    <v-row>
      <v-range-slider
        v-model="sliderRange"
        step="500"
        max="65535"
        :max-width="props.maxSize + 100"
        strict
        thumb-label="always"
        @update:modelValue="emit('updateScaling', props.imageName, sliderRange[0], sliderRange[1])"
      >
        <template v-slot:prepend>
          <v-text-field
            v-model="sliderRange[0]"
            density="compact"
            type="number"
            variant="outlined"
            step="100"
            style="width: 100px"
            hide-details
            single-line
            @update:modelValue="updateLowerScale">
          </v-text-field>
        </template>
        <template v-slot:append>
          <v-text-field
            v-model="sliderRange[1]"
            density="compact"
            type="number"
            variant="outlined"
            step="100"
            style="width: 100px"
            hide-details
            single-line
            @update:modelValue="updateUpperScale">
          </v-text-field>
          <v-btn
            class="ml-2"
            @click="zScaleImage"
          >ZScale</v-btn>
        </template>
      </v-range-slider>
    </v-row>
  </div>
</template>
<style scoped>
.image-scale-title {
  width: 100%;
  text-align: center;
  color: var(--tan);
  font-weight: bold;
}

</style>
