<script setup>
import { ref, computed } from 'vue'
import { fetchApiCall } from '../utils/api'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import NonLinearSlider from '@/components/Global/NonLinearSlider.vue'
import ImageDownloadMenu from '@/components/Analysis/ImageDownloadMenu.vue'
import FitsHeaderTable from '@/components/Analysis/FitsHeaderTable.vue'
import ImageViewer from '@/components/Analysis/ImageViewer.vue'
import LinePlot from '@/components/Analysis/LinePlot.vue'
import { siteIDToName } from '@/utils/common'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  image: {
    type: Object,
    required: true,
    default: null,
  }
})
const emit = defineEmits(['update:modelValue'])
const configStore = useConfigurationStore()
const alertsStore = useAlertsStore()

const lineProfile = ref([])
const lineProfileLength = ref()
const startCoords = ref()
const endCoords = ref()
const catalogToggle = ref(true)
const catalog = ref([])
const positionAngle = ref()
const headerDialog = ref(false)
const headerData = ref({})
const fluxSliderRange = ref([0, 10000])

const filteredCatalog = computed(() => {
  if(catalogToggle.value){
    return catalog.value.filter((source) => source.flux >= fluxSliderRange.value[0] && source.flux <= fluxSliderRange.value[1])
  }
  else{
    return []
  }
})

function closeDialog() {
  lineProfile.value = []
  catalog.value = []
  lineProfileLength.value = 0
  startCoords.value = null
  endCoords.value = null
  headerData.value = null
  positionAngle.value = null
  emit('update:modelValue', false)
}

// This function runs when imageViewer emits an analysis-action event and should be extended to handle other analysis types
function requestAnalysis(action, input, action_callback=null){
  const url = configStore.datalabApiBaseUrl + 'analysis/' + action + '/'
  const body = {
    'basename': props.image.basename,
    'source': props.image.source,
    ...input
  }
  fetchApiCall({url: url, method: 'POST', body: body, successCallback: (response) => {handleAnalysisOutput(response, action, action_callback)}})
}

// The successCallback function for the fetchApiCall in requestAnalysis new operations can be added here as an additional case
function handleAnalysisOutput(response, action, action_callback){
  switch (action) {
  case 'line-profile':
    lineProfile.value = response.line_profile
    lineProfileLength.value = response.arcsec
    endCoords.value = response.end_coords
    startCoords.value = response.start_coords
    positionAngle.value = response.position_angle
    break
  case 'source-catalog':
    catalog.value = response
    break
  case 'get-tif':
    action_callback(response.tif_url, props.image.basename, 'TIF')
    break
  default:
    console.error('Invalid action:', action)
    break
  }
}

// Toggles header dialog visibility, fetches headers from archive if they are not present
function showHeaderDialog() {
  if(headerData.value && Object.keys(headerData.value).length > 0) {
    headerDialog.value = true
  }
  else{
    const archiveHeadersUrl = configStore.datalabArchiveApiUrl + 'frames/' + props.image.id + '/headers/'
    fetchApiCall({url: archiveHeadersUrl, method: 'GET', 
      successCallback: (response) => {
        headerData.value = response.data
        headerDialog.value = true
      },
      failCallback: (error) => {
        console.error('Failed to fetch headers:', error)
        alertsStore.setAlert('error', `Could not fetch headers for frame ${props.image.id}`)
      }
    })
  }
}

</script>
<template>
  <v-dialog
    :model-value="modelValue"
    persistent
    fullscreen
  >
    <v-sheet class="analysis-page">
      <v-toolbar
        class="analysis-toolbar"
        density="comfortable"
      >
        <filter-badge
          v-if="image.FILTER || image.filter"
          :filter="image.FILTER || image.filter"
          class="ml-2"
        />
        <v-toolbar-title>{{ image.basename || "Unknown" }}</v-toolbar-title>
        <image-download-menu
          :image-name="image.basename"
          :fits-url="image.url || image.fits_url"
          :jpg-url="image.largeCachedUrl"
          @analysis-action="requestAnalysis"
        />
        <v-btn
          v-if="image.id"
          icon="mdi-information"
          @click="showHeaderDialog"
        />
        <v-btn
          icon="mdi-close"
          color="var(--cancel)"
          @click="closeDialog()"
        />
      </v-toolbar>
      <div class="analysis-content">
        <image-viewer
          :image-src="image.largeCachedUrl"
          :catalog="filteredCatalog"
          @analysis-action="requestAnalysis"
        />
        <div class="side-panel-container">
          <v-sheet
            v-if="image.site_id || image.telescope_id || image.instrument_id || image.observation_date"
            class="side-panel-item pa-4"
            rounded
          >
            <p v-if="image.site_id">
              <v-icon icon="mdi-earth" /> {{ siteIDToName(image.site_id) }}
            </p>
            <p v-if="image.telescope_id">
              <v-icon icon="mdi-telescope" /> {{ image.telescope_id }}
            </p>
            <p v-if="image.instrument_id">
              <v-icon icon="mdi-camera" /> {{ image.instrument_id }}
            </p>
            <p v-if="image.observation_date">
              <v-icon icon="mdi-clock" /> {{ new Date(image.observation_date).toLocaleString() }}
            </p>
          </v-sheet>
          <v-sheet
            v-if="catalog.length"
            rounded
            class="side-panel-item image-controls-sheet"
          >
            <b>{{ filteredCatalog.length }} Sources with Flux between {{ fluxSliderRange[0] }} and {{ fluxSliderRange[1] }}</b>
            <div class="d-flex justify-end">
              <v-btn
                class="mr-2"
                variant="text"
                title="Toggle Catalog"
                density="comfortable"
                icon="mdi-flare"
                :color="catalogToggle ? 'var(--light-blue)' : 'var(--tan)'"
                @click="() => catalogToggle = !catalogToggle"
              />
              <non-linear-slider
                v-model="fluxSliderRange"
                :max="Math.max(...catalog.map((source) => source.flux))"
                :min="Math.min(...catalog.map((source) => source.flux))"
              />
            </div>
          </v-sheet>
          <v-sheet
            class="side-panel-item line-plot-sheet"
            rounded
          >
            <line-plot
              :y-axis-data="lineProfile"
              :x-axis-length="lineProfileLength"
              :start-coords="startCoords"
              :end-coords="endCoords"
              :position-angle="positionAngle"
            />
          </v-sheet>
        </div>
      </div>
    </v-sheet>
  </v-dialog>
  <v-dialog
    v-model="headerDialog"
    width="600px"
    height="85vh"
  >
    <fits-header-table :header-data="headerData" />
  </v-dialog>
</template>
<style scoped>
/* Main Sections */
.analysis-page{
  background-color: var(--dark-blue);
  color: var(--tan);
  font-family: var(--font-stack);
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}
.analysis-toolbar{
  color: var(--tan);
  background-color: var(--metal);
}
.analysis-content{
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: 1rem;
}
/* Side Panel */
.side-panel-container {
  display: flex;
  flex-direction: column;
  margin-left: 1rem;
  width: 45vw;
}
.side-panel-item{
  padding: 1rem;
  color: var(--tan);
  background-color: var(--metal);
  margin-bottom: 1rem;
}
.line-plot-sheet {
  height: 100%;
  margin-bottom: 0;
}
</style>
