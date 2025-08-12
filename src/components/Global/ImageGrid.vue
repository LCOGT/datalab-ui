<script setup>
import { ref, watch } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import ThumbnailImage from '@/components/Global/ThumbnailImage.vue'
import AnalysisView from '../../views/AnalysisView.vue'

const props = defineProps({
  images: {
    type: Array,
    default: () => []
  },
  selectedImages: {
    type: Array,
    default: () => []
  },
  columnSpan: {
    type: Number,
    required: true
  },
  allowSelection: {
    type: Boolean,
    default: false
  },
  enableImageCards: {
    type: Boolean,
    default: true
  }
})

const configurationStore = useConfigurationStore()
const alertsStore = useAlertsStore()
const thumbnailsStore = useThumbnailsStore()
const emit = defineEmits(['selectImage'])
const showAnalysisDialog = ref(false)
const imageDetails = ref({})
const analysisImage = ref({})

async function ensureLargeCachedUrl(image) {
  if (!image.largeCachedUrl) {
    const url = image.large_url || image.largeThumbUrl || ''
    image.largeCachedUrl = await thumbnailsStore.cacheImage('large', configurationStore.archiveType, url, image.basename)
  }
  return image.largeCachedUrl
}

const launchAnalysis = async (image) => {
  alertsStore.setAlert('info', `Opening ${image?.basename} for analysis`)
  try {
    await ensureLargeCachedUrl(image)
    analysisImage.value = image
    showAnalysisDialog.value = true
  } catch {
    alertsStore.setAlert('error', `Failed to open ${image?.basename}`)
  }
}

const isSelected = (basename) => {
  return props.selectedImages.includes(basename)
}

watch(() => props.images, () => {
  props.images.forEach(image => {
    if (image.basename && !(image.basename in imageDetails.value)) {
      imageDetails.value[image.basename] = ref('')
      const url = image.smallThumbUrl || image.small_url ||''
      thumbnailsStore.cacheImage('small', configurationStore.archiveType, url, image.basename).then((cachedUrl) => {
        imageDetails.value[image.basename] = cachedUrl
      })
    }
  })
}, { deep: true, immediate: true })

</script>

<template>
  <v-row>
    <v-col
      v-for="(image, index) in props.images"
      :key="index"
      :cols="columnSpan"
      class="image-grid-col"
    >
      <thumbnail-image
        :image="image"
        :image-url="imageDetails[image.basename]"
        :is-selected="isSelected(image.basename)"
        :enable-image-cards="true"
        :enable-removal="false"
        @select-image="emit('selectImage', image.basename)"
        @launch-analysis="launchAnalysis(image)"
      ></thumbnail-image>
    </v-col>
  </v-row>
  <v-dialog
    v-model="showAnalysisDialog"
    fullscreen
  >
    <analysis-view
      :image="analysisImage"
      @close-analysis-dialog="showAnalysisDialog = false"
    />
  </v-dialog>
</template>

<style scoped>
.selected-image {
  outline: 0.3rem solid var(--primary-interactive);
}
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
