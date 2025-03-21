<script setup>
import { ref, watch } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import FilterBadge from './FilterBadge.vue'
import AnalysisView from '../../views/AnalysisView.vue'

const props = defineProps({
  images: {
    type: [Array, Boolean],
    default: false
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
  }
})

const configurationStore = useConfigurationStore()
const alertsStore = useAlertsStore()
const thumbnailsStore = useThumbnailsStore()
const emit = defineEmits(['selectImage'])
const showAnalysisDialog = ref(false)
const imageDetails = ref({})
const analysisImage = ref({})
var doubleClickTimer = 0

const handleClick = (basename) => {
  clearTimeout(doubleClickTimer)
  // timeout length indicates how long to wait for a second click before treating as a single click
  doubleClickTimer = setTimeout(() => {
    emit('selectImage', basename)
    doubleClickTimer = 0
  }, 250)
}

const handleDoubleClick = (image) => {
  clearTimeout(doubleClickTimer)
  alertsStore.setAlert('info', `Opening ${image?.basename} for analysis`)
  launchAnalysis(image)
}

const launchAnalysis = (image) => {
  try {
    if (!image.largeCachedUrl) {
      image.largeCachedUrl = ref('')
      const url = image.large_url || image.largeThumbUrl || ''
      thumbnailsStore.cacheImage('large', configurationStore.archiveType, url, image.basename).then((cachedUrl) => {
        image.largeCachedUrl = cachedUrl
        analysisImage.value = image
        showAnalysisDialog.value = true
      })
    }
    else {
      analysisImage.value = image
      showAnalysisDialog.value = true
    }
  } catch {
    alertsStore.setAlert('error', `Failed to open ${image?.basename}`)
  }
}

const isSelected = (basename) => {
  return props.selectedImages.includes(basename)
}

watch(() => props.images, () => {
  if (!props.images) return
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
    <template v-if="props.images">
      <v-col
        v-for="(image, index) in props.images"
        :key="index"
        :cols="columnSpan"
        class="image-grid-col"
      >
        <v-img
          v-if="image.basename in imageDetails && imageDetails[image.basename]"
          :src="imageDetails[image.basename]"
          :alt="image.basename"
          cover
          :class="{ 'selected-image': isSelected(image.basename) }"
          aspect-ratio="1"
          @click="handleClick(image.basename)"
          @dblclick="handleDoubleClick(image)"
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
        <v-skeleton-loader
          v-else
          type="card"
          color="var(--secondary-background)"
          bg-color="var(--primary-background)"
        />
      </v-col>
    </template>
    <template v-else>
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
    persistent
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
  border: 0.3rem solid var(--primary-interactive);
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
