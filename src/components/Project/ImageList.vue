<script setup>
import { ref } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useAlertsStore } from '@/stores/alerts'
import { useConfigurationStore } from '@/stores/configuration'
import { siteIDToName } from '@/utils/common'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import ImageAnalyzer from '../../views/ImageAnalysisView.vue'

const props = defineProps({
  images: {
    type: [Array, Boolean],
    default: false
  },
  selectedImages: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['selectImage'])

const headers = ref([
  { title: 'IMAGE', align: 'start', sortable: false, key: 'url' },
  { title: 'TARGET', align: 'start', sortable: true, key: 'target_name' },
  { title: 'FILTER', align: 'start', sortable: true, key: 'primary_optical_element' },
  { title: 'TIME', align: 'start', sortable: true, key: 'observation_date' },
  { title: 'SITE', align: 'start', sortable: true, key: 'site_id' },
  { title: 'IMAGE NAME', align: 'start', sortable: true, key: 'basename' },
])
const showAnalysisDialog = ref(false)
const analysisImage = ref({})
const alertsStore = useAlertsStore()
const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()

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

// checks difference between table and parent selected images and emits the difference
function select(tableModel){
  const symDiffSelected = tableModel.filter(image => !props.selectedImages.includes(image)).concat(props.selectedImages.filter(image => !tableModel.includes(image)))
  for (const basename of symDiffSelected) {
    emit('selectImage', basename)
  }
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

async function launchAnalysis(image){
  try {
    alertsStore.setAlert('info', `Opening ${image?.basename} for analysis`)
    await ensureLargeCachedUrl(image)
    analysisImage.value = getAnalysisImage(image)
    showAnalysisDialog.value = true
  } catch (error) {
    console.error(error)
    alertsStore.setAlert('error', `Failed to open ${image?.basename}`)
  }
}

function showAdjacentImage(direction){
  const currentIndex = props.images.findIndex((image) => image.basename === analysisImage.value?.basename)
  if (currentIndex < 0) return

  const nextImage = props.images[currentIndex + direction]
  if (!nextImage) return

  launchAnalysis(nextImage)
}

</script>

<template>
  <v-data-table
    v-if="images"
    :model-value="selectedImages"
    :headers="headers"
    :items="images"
    item-value="basename"
    :items-per-page="images.length"
    show-select
    hide-default-footer
    hide-no-data
    class="data_table"
    @update:model-value="select"
  >
    <template #[`item.observation_date`]="{ item }">
      <p>{{ new Date(item.observation_date).toLocaleString() }}</p>
    </template>
    <template #[`item.site_id`]="{ item }">
      <p>{{ siteIDToName(item.site_id) }}</p>
    </template>
    <template #[`item.primary_optical_element`]="{ item }">
      <filter-badge
        v-if="item.primary_optical_element"
        :filter="item.primary_optical_element"
      />
    </template>
    <template #[`item.url`]="{ item }">
      <v-img
        v-if="item.smallCachedUrl"
        :src="item.smallCachedUrl"
        :alt="item.OBJECT"
        class="list_image"
        cover
        loading="lazy"
        @click="launchAnalysis(item)"
      />
      <v-progress-circular
        v-else
        indeterminate
        :width="8"
      />
    </template>
  </v-data-table>
  <v-skeleton-loader
    v-else
    type="table"
    color="var(--secondary-background)"
    bg-color="var(--primary-background)"
  />
  <v-dialog
    v-model="showAnalysisDialog"
    persistent
    fullscreen
  >
    <image-analyzer
      :image="analysisImage"
      @close-analysis-dialog="showAnalysisDialog = false"
      @request-previous-image="showAdjacentImage(-1)"
      @request-next-image="showAdjacentImage(1)"
    />
  </v-dialog>
</template>

<style scoped>
.data_table {
  font-size: 1rem;
  color: var(--text);
  background-color: var(--card-background);
}
.data_table :deep(td) {
  vertical-align: middle;
}
.list_image{
  width: 100px;
}
</style>
