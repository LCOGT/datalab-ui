<script setup>
import { ref, watch } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import ImageDownloadMenu from '@/components/Global/ImageDownloadMenu.vue'
import FilterBadge from './FilterBadge.vue'
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
      <v-sheet
        v-if="image.basename in imageDetails && imageDetails[image.basename]"
        class="pa-2"
        color="var(--secondary-background)"
        :elevation="2"
        rounded
        :class="{ 'selected-image': isSelected(image.basename) }"
        @click="emit('selectImage', image.basename)"
      >
        <v-img
          :src="imageDetails[image.basename]"
          :alt="image.basename"
          rounded
          cover
          aspect-ratio="1"
        >
          <filter-badge
            v-if="image.filter || image.FILTER"
            :filter="image.filter || image.FILTER"
          />
          <span
            v-if="'operationIndex' in image"
            class="image-text-overlay"
          >{{ image.operationIndex }}</span>
        </v-img>
        <div
          v-if="props.enableImageCards"
          class="d-flex flex-row ga-2 align-center mt-2"
        >
          <p class="text-subtitle-2 mr-auto prevent-select single-line-text">
            {{ image.target_name || image.operationName }}
          </p>
          <v-icon
            icon="mdi-eye"
            color="var(--primary-interactive)"
            @click.stop="launchAnalysis(image)"
          />
          <image-download-menu
            :fits-url="image.url || image.fits_url || ''"
            :jpg-url="image.largeCachedUrl || image.large_url || ''"
            :image-name="image.basename"
            speed-dial-location="top right"
            :enable-scaled-download="false"
          />
        </div>
      </v-sheet>
      <v-skeleton-loader
        v-else
        type="card"
        color="var(--secondary-background)"
        bg-color="var(--primary-background)"
      />
    </v-col>
    <template v-if="props.images.length === 0">
      <v-col
        v-for="n in 10"
        :key="n"
        :cols="columnSpan"
        class="image-grid-col"
      >
        <v-skeleton-loader
          type="card"
          class="ma-1"
          color="var(--secondary-background)"
          bg-color="var(--primary-background)"
        />
      </v-col>
    </template>
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
