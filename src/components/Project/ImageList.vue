<script setup>
import { ref, computed, defineProps } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useAlertsStore } from '@/stores/alerts'
import { useConfigurationStore } from '@/stores/configuration'
import { siteIDToName } from '@/utils/common'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import ImageAnalyzer from '../Project/ImageAnalysis/ImageAnalyzer.vue'

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

// Adding index key so @select component emits selected image index
const indexedImages = computed(() => {
  return props.images ? props.images.map((image, index) => {
    return {
      ...image,
      index
    }
  }) : []
})

const headers = ref([
  { title: 'IMAGE', align: 'start', sortable: false, key: 'url' },
  { title: 'FILTER', align: 'start', sortable: true, key: 'FILTER' },
  { title: 'IMAGE NAME', align: 'start', sortable: true, key: 'basename' },
  { title: 'TARGET', align: 'start', sortable: true, key: 'target_name' },
  { title: 'TIME', align: 'start', sortable: true, key: 'observation_date' },
  { title: 'SITE', align: 'start', sortable: true, key: 'site_id' },
  { title: 'TELESCOPE', align: 'start', sortable: true, key: 'telescope_id' },
])
const showAnalysisDialog = ref(false)
const analysisImage = ref({})
const alertsStore = useAlertsStore()
const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()

function select(tableSelectedImages){
  // check for the difference between selectedImages and event and return the unique indexes
  for (const index of tableSelectedImages.filter(x => !props.selectedImages.includes(x))) {
    emit('selectImage', index)
  }
}

function launchAnalysis(image){
  try {
    alertsStore.setAlert('info', `Opening ${image?.basename} for analysis`)
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
  } catch (error) {
    console.error(error)
    alertsStore.setAlert('error', `Failed to open ${image?.basename}`)
  }
}

</script>

<template>
  <v-data-table
    v-if="images"
    :model-value="selectedImages"
    :headers="headers"
    :items="indexedImages"
    item-value="index"
    :items-per-page="images.length"
    show-select
    hover
    hide-default-footer
    hide-no-data
    class="data_table"
    @update:model-value="select"
  >
    <template #[`header.data-table-select`] /> <!--Hides select all checkbox-->
    <template #[`item.observation_date`]="{ item }">
      <p>{{ new Date(item.observation_date).toLocaleString() }}</p>
    </template>
    <template #[`item.site_id`]="{ item }">
      <p>{{ siteIDToName(item.site_id) }}</p>
    </template>
    <template #[`item.FILTER`]="{ item }">
      <filter-badge
        v-if="item.FILTER"
        :filter="item.FILTER"
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
    color="var(--dark-blue)"
    bg-color="var(--metal)"
  />
  <image-analyzer
    v-model="showAnalysisDialog"
    :image="analysisImage"
  />
</template>

<style scoped>
.data_table {
  font-family: 'Open Sans', sans-serif;
  font-size: 1rem;
  color: var(--tan);
  background-color: var(--metal);
}
.list_image{
  width: 8vw;
}
</style>
