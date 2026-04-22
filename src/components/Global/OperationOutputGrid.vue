<script setup>
import { ref, watch } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import ThumbnailImage from '@/components/Global/ThumbnailImage.vue'
import DataOutput from '@/components/Global/DataOutput.vue'
import ImageAnalysisView from '@/views/ImageAnalysisView.vue'
import DataAnalysisView from '@/views/DataAnalysisView.vue'

const props = defineProps({
  operationOutputs: {
    type: Array,
    default: () => []
  },
  images: {
    type: Array,
    default: () => []
  },
  columnSpan: {
    type: Number,
    required: true
  },
  enableImageCards: {
    type: Boolean,
    default: true
  }
})


const configurationStore = useConfigurationStore()
const alertsStore = useAlertsStore()
const thumbnailsStore = useThumbnailsStore()
const showImageAnalysisDialog = ref(false)
const showDataAnalysisDialog = ref(false)
const imageDetails = ref({})
const analysisImage = ref({})
const analysisData = ref({})

function getAnalysisImage(image) {
  const currentIndex = props.images.findIndex((candidate) => candidate.basename === image?.basename)
  return {
    ...image,
    hasPrevious: currentIndex > 0,
    hasNext: currentIndex > -1 && currentIndex < props.images.length - 1,
  }
}

function imageArchiveSource(image) {
  if (image?.source && image.source !== 'archive') {
    return image.source
  }
  return configurationStore.archiveType
}

async function ensureLargeCachedUrl(image) {
  const url = image.large_url || image.largeThumbUrl || ''
  image.largeCachedUrl = await thumbnailsStore.cacheImage(
    'large',
    imageArchiveSource(image),
    url,
    image.basename,
  )
  return image.largeCachedUrl
}

const launchAnalysis = async (image) => {
  alertsStore.setAlert('info', `Opening ${image?.basename} for analysis`)
  try {
    await ensureLargeCachedUrl(image)
    analysisImage.value = getAnalysisImage(image)
    showImageAnalysisDialog.value = true
  } catch {
    alertsStore.setAlert('error', `Failed to open ${image?.basename}`)
  }
}

const launchDataAnalysis = async (data) => {
  analysisData.value = data
  showDataAnalysisDialog.value = true
}

function isImage(operationOutput) {
  if (operationOutput.basename) {
    return true
  }
  return false
}

async function showAdjacentImage(direction) {
  const currentIndex = props.images.findIndex((image) => image.basename === analysisImage.value?.basename)
  if (currentIndex < 0) return

  const nextImage = props.images[currentIndex + direction]
  if (!nextImage) return

  await ensureLargeCachedUrl(nextImage)
  analysisImage.value = getAnalysisImage(nextImage)
}

watch(() => props.operationOutputs, () => {
  props.operationOutputs.forEach(operationOutput => {
    if (operationOutput.basename && !(operationOutput.basename in imageDetails.value)) {
      imageDetails.value[operationOutput.basename] = ref('')
      const url = operationOutput.smallThumbUrl || operationOutput.small_url ||''
      thumbnailsStore.cacheImage('small', configurationStore.archiveType, url, operationOutput.basename).then((cachedUrl) => {
        imageDetails.value[operationOutput.basename] = cachedUrl
      })
    }
  })
}, { deep: true, immediate: true })

</script>

<template>
  <v-row>
    <v-col
      v-for="(operationOutput, index) in props.operationOutputs"
      :key="index"
      :cols="columnSpan"
      class="image-grid-col"
    >
      <thumbnail-image
        v-if="isImage(operationOutput)"
        :image="operationOutput"
        :image-url="imageDetails[operationOutput.basename]"
        :is-selected="false"
        :enable-image-cards="true"
        :enable-removal="false"
        @launch-analysis="launchAnalysis(operationOutput)"
      />
      <data-output
        v-if="!isImage(operationOutput)"
        :operation-output="operationOutput"
        :is-selected="false"
        :enable-cards="true"
        :enable-removal="false"
        @launch-analysis="launchDataAnalysis(operationOutput)"
      />
    </v-col>
  </v-row>
  <v-dialog
    v-model="showImageAnalysisDialog"
    fullscreen
  >
    <image-analysis-view
      :image="analysisImage"
      @close-analysis-dialog="showImageAnalysisDialog = false"
      @request-previous-image="showAdjacentImage(-1)"
      @request-next-image="showAdjacentImage(1)"
    />
  </v-dialog>
  <v-dialog
    v-model="showDataAnalysisDialog"
    fullscreen
  >
    <data-analysis-view
      :data="analysisData"
      @close-analysis-dialog="showDataAnalysisDialog = false"
    />
  </v-dialog>
</template>

<style scoped>
.image-text-overlay {
  color: var(--text);
  font-weight: bold;
  margin-right: 5px;
  float: right;
}
.image-grid-col {
  max-width: 200px;
}
</style>
