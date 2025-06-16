<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchApiCall } from '../utils/api'
import { useConfigurationStore } from '@/stores/configuration'
import { useAnalysisStore } from '@/stores/analysis'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import NonLinearSlider from '@/components/Global/NonLinearSlider.vue'
import HistogramSlider from '@/components/Global/Scaling/HistogramSlider.vue'
import ImageDownloadMenu from '@/components/Analysis/ImageDownloadMenu.vue'
import FitsHeaderTable from '@/components/Analysis/FitsHeaderTable.vue'
import ImageViewer from '@/components/Analysis/ImageViewer.vue'
import LinePlot from '@/components/Analysis/LinePlot.vue'
import VariableStarPlot from '@/components/Analysis/VariableStarPlot.vue'

const props = defineProps({
  image: {
    type: Object,
    required: true,
    default: null,
  }
})

const emit = defineEmits(['closeAnalysisDialog'])

const configStore = useConfigurationStore()
const analysisStore = useAnalysisStore()

const lineProfile = ref([])
const lineProfileLength = ref()
const startCoords = ref()
const endCoords = ref()
const catalogToggle = ref(true)
const catalog = ref([])
const sideChart = ref('')
const fluxSliderRange = ref([0, 10000])
const positionAngle = ref()
const showHeaderDialog = ref(false)
const imgWorker = new Worker('drawImageWorker.js')
let imgWorkerProcessing = false
let imgWorkerNextScale = null

const filteredCatalog = computed(() => {
  if (!catalogToggle.value) {
    return []
  }
  return catalog.value.filter(source =>
    source.flux >= fluxSliderRange.value[0] &&
    source.flux <= fluxSliderRange.value[1]
  )
})

onMounted(() => {
  analysisStore.image = props.image
  analysisStore.imageUrl = props.image.largeCachedUrl
  analysisStore.loadHeaderData()
  instantiateScalerWorker()
})

onUnmounted(() => {
  imgWorker.terminate()
  analysisStore.$reset()
})

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
    sideChart.value = 'Line Profile'
    break
  case 'source-catalog':
    catalog.value = response
    break
  case 'variable-star':
    analysisStore.setLightCurveData(response)
    sideChart.value = 'Light Curve'
    break
  case 'get-tif':
    action_callback(response.tif_url, props.image.basename, 'TIF')
    break
  case 'get-jpg':
    action_callback(response.jpg_base64, props.image.basename, 'base64')
    break
  default:
    console.error('Invalid action:', action)
    break
  }
}

async function instantiateScalerWorker(){
  // Load the image scale data if it is not already loaded
  try { await analysisStore.loadScaleData() } 
  catch (error) { return console.error('Failed to load scale data:', error) }

  // Create a new offscreen canvas for the worker
  const imgScalingCanvas = document.createElement('canvas')
  imgScalingCanvas.width = analysisStore.imageWidth
  imgScalingCanvas.height = analysisStore.imageHeight
  const offscreen = imgScalingCanvas.transferControlToOffscreen()

  // Post the image data to the worker
  imgWorker.postMessage({
    canvas: offscreen,
    width: analysisStore.imageWidth,
    height: analysisStore.imageHeight,
    imageData: structuredClone(analysisStore.rawData)
  }, [offscreen])

  // Image creation for leaflet map, clean up the old image url
  imgWorker.onmessage = (event) => {
    imgWorkerProcessing = false
    if(event.data.blob){
      analysisStore.imageUrl = URL.createObjectURL(event.data.blob)
    }
  }
}

function updateScaling(min, max){
  imgWorkerNextScale = [min, max]

  if (imgWorkerNextScale && !imgWorkerProcessing){
    imgWorkerProcessing = true
    imgWorker.postMessage({scalePoints: [...imgWorkerNextScale]})
    imgWorkerNextScale = null
  }
}

</script>
<template>
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
      <v-toolbar-title :text="image.basename || 'Unknown'" />
      <image-download-menu
        :image-name="image.basename"
        :fits-url="image.url || image.fits_url"
        :jpg-url="image.largeCachedUrl"
        @analysis-action="requestAnalysis"
      />
      <v-btn
        v-if="image.id"
        icon="mdi-information"
        @click="showHeaderDialog = analysisStore.loadHeaderData()"
      />
      <v-btn
        icon="mdi-close"
        color="var(--cancel)"
        @click="emit('closeAnalysisDialog')"
      />
    </v-toolbar>
    <div class="analysis-content">
      <image-viewer
        :catalog="filteredCatalog"
        @analysis-action="requestAnalysis"
      />
      <div class="side-panel-container">
        <v-expand-transition>
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
                :color="catalogToggle ? 'var(--primary-interactive)' : 'var(--disabled-text)'"
                @click="() => catalogToggle = !catalogToggle"
              />
              <non-linear-slider
                v-model="fluxSliderRange"
                :max="Math.max(...catalog.map((source) => source.flux))"
                :min="Math.min(...catalog.map((source) => source.flux))"
              />
            </div>
          </v-sheet>
        </v-expand-transition>
        <v-expand-transition>
          <v-sheet
            class="side-panel-item"
            rounded
          >
            <histogram-slider
              v-if="analysisStore.imageScaleReady"
              :histogram="analysisStore.histogram"
              :bins="analysisStore.bins"
              :max-value="analysisStore.maxPixelValue"
              :z-min="Number(analysisStore.zmin)"
              :z-max="Number(analysisStore.zmax)"
              @update-scaling="updateScaling"
            />
            <div
              v-else-if="analysisStore.imageScaleLoading"
              class="d-flex ga-4 align-center justify-center"
            >
              <p class="d-block">
                Histogram
              </p>
              <v-progress-linear
                color="var(--success)"
                :height="6"
                indeterminate
                rounded
              />
            </div>
          </v-sheet>
        </v-expand-transition>
        <v-expand-transition>
          <v-sheet
            v-show="lineProfile.length || analysisStore.lightCurve"
            class="side-panel-item"
          >
            <v-select
              v-model="sideChart"
              :items="['Line Profile', 'Light Curve']"
              variant="solo-filled"
              bg-color="var(--card-background)"
              density="compact"
            />
            <line-plot
              v-show="lineProfile.length && sideChart === 'Line Profile'"
              :y-axis-data="lineProfile"
              :x-axis-length="lineProfileLength"
              :start-coords="startCoords"
              :end-coords="endCoords"
              :position-angle="positionAngle"
            />
            <variable-star-plot v-show="analysisStore.lightCurve && sideChart === 'Light Curve'" />
          </v-sheet>
        </v-expand-transition>
      </div>
    </div>
  </v-sheet>
  <v-dialog
    v-model="showHeaderDialog"
    width="600px"
    height="85vh"
  >
    <fits-header-table />
  </v-dialog>
</template>
<style scoped>
/* Main Sections */
.analysis-page{
  background-color: var(--primary-background);
  color: var(--text);
  font-family: var(--font-stack);
  height: 100vh;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}
.analysis-toolbar{
  color: var(--text);
  background-color: var(--header);
}
.analysis-content{
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: 0.5rem;
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
  color: var(--text);
  background-color: var(--card-background);
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
}

.side-panel-item:last-of-type {
  margin-bottom: 0;
  height: 100%;
}

.v-tabs-window{
  margin-top: 0.5rem
}
</style>
