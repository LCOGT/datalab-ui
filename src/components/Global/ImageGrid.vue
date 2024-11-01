<script setup>
import { ref, watch } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import FilterBadge from './FilterBadge.vue'
import ImageAnalyzer from '../Project/ImageAnalysis/ImageAnalyzer.vue'

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

let imageDetails = ref({})
const configurationStore = useConfigurationStore()
const alertsStore = useAlertsStore()
const thumbnailsStore = useThumbnailsStore()
const emit = defineEmits(['selectImage'])
const showAnalysisDialog = ref(false)
const analysisImage = ref({})
var doubleClickTimer = 0

const handleClick = (index) => {
  clearTimeout(doubleClickTimer)
  // timeout length indicates how long to wait for a second click before treating as a single click
  doubleClickTimer = setTimeout(() => {
    emit('selectImage', index)
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

const isSelected = (index) => {
  return props.selectedImages.includes(index)
}

watch(() => props.images, () => {
  if (!props.images) return
  props.images.forEach(image => {
    if (image.basename && !(image.basename in imageDetails.value)) {
      imageDetails.value[image.basename] = ref('')
      const url = image.thumbnail_url || image.smallThumbUrl || ''
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
          :class="{ 'selected-image': isSelected(index) }"
          aspect-ratio="1"
          @click="handleClick(index)"
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
          color="var(--dark-blue)"
          bg-color="var(--metal)"
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
          color="var(--dark-blue)"
          bg-color="var(--metal)"
        />
      </v-col>
    </template>
  </v-row>
  <image-analyzer
    v-model="showAnalysisDialog"
    :image="analysisImage"
  />
</template>

<style scoped>
.selected-image {
  border: 0.3rem solid var(--dark-green);
}

.image-text-overlay {
  color: var(--tan);
  font-weight: bold;
  margin-right: 5px;
  float: right;
}
.image-grid-col {
  max-width: 200px;
}
</style>
