<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { fetchApiCall } from '../utils/api'
import { basenameToSequence, siteIDToName } from '@/utils/common'
import { useConfigurationStore } from '@/stores/configuration'
import { useAnalysisStore } from '@/stores/analysis'
import { useUserDataStore } from '@/stores/userData'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import NonLinearSlider from '@/components/Global/NonLinearSlider.vue'
import HistogramSlider from '@/components/Global/Scaling/HistogramSlider.vue'
import ImageDownloadMenu from '@/components/Global/ImageDownloadMenu.vue'
import FitsHeaderTable from '@/components/Analysis/FitsHeaderTable.vue'
import ImageViewer from '@/components/Analysis/ImageViewer.vue'
import LinePlot from '@/components/Analysis/LinePlot.vue'
import ViewMode from '@/components/Analysis/ViewMode.vue'
import { getActivePinia } from 'pinia'

const props = defineProps({
  image: {
    type: Object,
    required: true,
    default: null,
  }
})

const emit = defineEmits(['closeAnalysisDialog', 'requestPreviousImage', 'requestNextImage'])

const configStore = useConfigurationStore()
const analysisStore = useAnalysisStore()
const userDataStore = useUserDataStore()

const lineProfile = ref([])
const lineProfileLength = ref()
const startCoords = ref()
const endCoords = ref()
const catalog = ref([])
const sideChart = ref('')
const fluxSliderRange = ref([0, 10000])
const positionAngle = ref()
const wcsSolution = ref()
const centroidRegion = ref(null)
const centroidResult = ref(null)
const centroidToolActive = ref(false)
const usePlaneBackground = ref(false)
const showHeaderDialog = ref(false)
const selectedBasename = ref(props.image?.basename || '')
const activeImage = ref(props.image)
let imgWorker = new Worker('drawImageWorker.js')
let imgWorkerProcessing = false
let imgWorkerNextScale = null
const scalerReady = ref(false)
const touchStartX = ref(null)

const selectedMode = ref(userDataStore.imageDisplayMode || 'Analysis Mode')

const filteredCatalog = computed(() => {
  if (!userDataStore.catalogToggle) {
    return []
  }
  return catalog.value.filter(source =>
    source.flux >= fluxSliderRange.value[0] &&
    source.flux <= fluxSliderRange.value[1]
  )
})

const isFitsImage = computed(() => {
  return activeImage.value && (!('type' in activeImage.value) || activeImage.value?.type === 'fits')
})

const basenameSequence = computed(() => basenameToSequence(activeImage.value?.basename || ''))

const headerChips = computed(() => {
  const headerData = analysisStore.headerData

  if (!headerData) {
    return [
      { icon: 'mdi-numeric', text: basenameSequence.value }
    ]
  }

  return [
    { icon: 'mdi-earth', text: siteIDToName(headerData.SITEID) },
    { icon: 'mdi-telescope', text: headerData.TELID },
    { icon: 'mdi-camera', text: headerData.INSTRUME },
    { icon: 'mdi-clock', text: new Date(headerData.DATE).toLocaleString() },
    { icon: 'mdi-numeric', text: basenameSequence.value }
  ]
})

const viewModeDetails = computed(() => {
  const headerData = analysisStore.headerData || {}

  return [
    { label: 'RA', value: headerData.RA || 'Unknown' },
    { label: 'Dec', value: headerData.DEC || 'Unknown' },
    { label: 'Object', value: headerData.OBJECT || 'Unknown' }
  ]
})

onMounted(async() => {
  window.addEventListener('keydown', handleKeydown)
  await loadActiveImage(props.image)
})

watch(() => props.image, async (image) => {
  if (!image?.basename) return

  selectedBasename.value = image.basename
  await loadActiveImage(image)
})

watch(selectedMode, (mode) => {
  userDataStore.imageDisplayMode = mode
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  cleanupWorker()
  analysisStore.$dispose()
  delete getActivePinia().state.value[analysisStore.$id]
})

function cleanupWorker() {
  if (imgWorker) {
    imgWorker.terminate()
    imgWorker = null
  }
  scalerReady.value = false
}

function resetAnalysisState() {
  lineProfile.value = []
  lineProfileLength.value = null
  startCoords.value = null
  endCoords.value = null
  catalog.value = []
  sideChart.value = ''
  fluxSliderRange.value = [0, 10000]
  positionAngle.value = null
  wcsSolution.value = null
  centroidRegion.value = null
  centroidResult.value = null
  centroidToolActive.value = false
  usePlaneBackground.value = false
  showHeaderDialog.value = false
  imgWorkerProcessing = false
  imgWorkerNextScale = null
  scalerReady.value = false
  analysisStore.headerData = null
  analysisStore.rawData = null
  analysisStore.zmin = null
  analysisStore.zmax = null
  analysisStore.imageWidth = null
  analysisStore.imageHeight = null
  analysisStore.imageScaleLoading = false
  analysisStore.magTimeSeries = []
}

async function loadActiveImage(image) {
  if (!image) return

  if (analysisStore.image?.basename !== image.basename) {
    analysisStore.headerData = null
  }

  cleanupWorker()

  if (selectedMode.value === 'Analysis Mode') {
    resetAnalysisState()
  }

  selectedBasename.value = image.basename
  activeImage.value = image
  analysisStore.image = image

  analysisStore.imageUrl = image.largeCachedUrl || image.large_url || image.largeThumbUrl || ''

  if (isFitsImage.value) {
    analysisStore.loadHeaderData()

    if (selectedMode.value !== 'Analysis Mode') {
      return
    }

    imgWorker = new Worker('drawImageWorker.js')
    instantiateScalerWorker()
  }
}

function requestPreviousImage() {
  emit('requestPreviousImage')
}

function requestNextImage() {
  emit('requestNextImage')
}

function handleKeydown(event) {
  if (selectedMode.value !== 'View Mode') return

  if (event.key === 'ArrowLeft') {
    requestPreviousImage()
  } else if (event.key === 'ArrowRight') {
    requestNextImage()
  }
}

function handleViewTouchStart(event) {
  touchStartX.value = event.changedTouches[0]?.clientX ?? null
}

function handleViewTouchEnd(event) {
  if (touchStartX.value == null || selectedMode.value !== 'View Mode') {
    return
  }

  const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX.value
  const deltaX = touchEndX - touchStartX.value
  touchStartX.value = null

  if (Math.abs(deltaX) < 40) return

  if (deltaX < 0) {
    requestNextImage()
  } else {
    requestPreviousImage()
  }
}

// This function runs when imageViewer emits an analysis-action event and should be extended to handle other analysis types
function requestAnalysis(action, input={}, action_callback=null){
  if(isFitsImage.value || action === 'get-tif' || action === 'get-jpg'){
    const url = configStore.datalabApiBaseUrl + 'analysis/' + action + '/'
    const body = {
      'basename': activeImage.value.basename,
      'source': activeImage.value.source,
      ...input
    }
    fetchApiCall({url: url, method: 'POST', body: body, successCallback: (response) => {handleAnalysisOutput(response, action, action_callback)}})
  }
}

// The successCallback function for the fetchApiCall in requestAnalysis new operations can be added here as an additional case
function handleAnalysisOutput(response, action, action_callback){
  switch (action) {
  case 'centroiding':
    centroidResult.value = response
    if (response?.success && centroidRegion.value) {
      centroidRegion.value = {
        ...centroidRegion.value,
        x: response.x,
        y: response.y,
        ra: response.ra,
        dec: response.dec,
      }
    }
    break
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
  case 'wcs':
    wcsSolution.value = response
    break
  case 'get-tif':
    // ImageDownloadMenu.vue downloadFile()
    action_callback(response.tif_url, activeImage.value.basename, 'TIF')
    break
  case 'get-jpg':
    // ImageDownloadMenu.vue downloadFile()
    action_callback(response.jpg_base64, activeImage.value.basename, 'base64')
    break
  default:
    console.error('Invalid action:', action)
    break
  }
}

function handleCentroidRegionUpdated(region) {
  centroidRegion.value = region
  centroidResult.value = null
}

function requestCentroid() {
  if (!centroidRegion.value?.ready) {
    return
  }

  requestAnalysis('centroiding', {
    x: centroidRegion.value.x,
    y: centroidRegion.value.y,
    width: centroidRegion.value.width,
    height: centroidRegion.value.height,
    radius: centroidRegion.value.radius,
    r_back1: centroidRegion.value.r_back1,
    r_back2: centroidRegion.value.r_back2,
    find_centroid: true,
    remove_background_stars: true,
    use_plane_background: usePlaneBackground.value,
  })
}

async function instantiateScalerWorker(){
  scalerReady.value = false

  // Load the image scale data if it is not already loaded
  try { await analysisStore.loadScaleData() } 
  catch (error) { return console.error('Failed to load scale data:', error) }

  if (!imgWorker || !analysisStore.imageWidth || !analysisStore.imageHeight || !analysisStore.rawData?.data) {
    return
  }

  // Create a new offscreen canvas for the worker
  const imgScalingCanvas = document.createElement('canvas')
  imgScalingCanvas.width = analysisStore.imageWidth
  imgScalingCanvas.height = analysisStore.imageHeight
  const offscreen = imgScalingCanvas.transferControlToOffscreen()

  const rawDataCopy = JSON.parse(JSON.stringify(analysisStore.rawData))

  // Post the image data to the worker
  imgWorker.postMessage({
    canvas: offscreen,
    imageData: rawDataCopy,
  }, [offscreen])

  scalerReady.value = true

  // Image creation for leaflet map, clean up the old image url
  imgWorker.onmessage = (event) => {
    imgWorkerProcessing = false
    if(event.data.blob){
      analysisStore.imageUrl = URL.createObjectURL(event.data.blob)
    }
  }
}

function updateScaling(min, max){
  if (!isFitsImage.value || selectedMode.value !== 'Analysis Mode' || !imgWorker) {
    return
  }

  imgWorkerNextScale = [min, max]

  if (imgWorkerNextScale && !imgWorkerProcessing){
    imgWorkerProcessing = true
    imgWorker.postMessage({scalePoints: [...imgWorkerNextScale]})
    imgWorkerNextScale = null
  }
}

async function onModeChange(val) {
  selectedMode.value = val

  if (val === 'Analysis Mode') {
    await loadActiveImage(props.image)
  }
}

</script>
<template>
  <div class="mode-toggle-center">
    <v-btn-toggle
      :model-value="selectedMode"
      class="mode-toggle"
      density="comfortable"
      mandatory
      rounded="lg"
      @update:model-value="onModeChange"
    >
      <v-btn value="View Mode">
        View Mode
      </v-btn>
      <v-btn value="Analysis Mode">
        Analysis Mode
      </v-btn>
    </v-btn-toggle>
  </div>
  <v-sheet class="analysis-page">
    <v-toolbar
      class="analysis-toolbar"
      density="comfortable"
    >
      <filter-badge
        v-if="activeImage?.FILTER || activeImage?.filter"
        :filter="activeImage?.FILTER || activeImage?.filter"
        class="ml-2"
      />
      <div class="analysis-toolbar-chips">
        <v-chip
          v-for="chip in headerChips"
          :key="chip.icon"
          :prepend-icon="chip.icon"
          color="var(--info)"
          :text="chip.text"
          size="small"
        />
      </div>
      <image-download-menu
        :image-name="activeImage?.basename"
        :fits-url="activeImage?.url || activeImage?.fits_url"
        :jpg-url="activeImage?.largeCachedUrl"
        :enable-scaled-download="isFitsImage"
        @analysis-action="requestAnalysis"
      />
      <v-btn
        v-if="activeImage?.id"
        icon="mdi-information"
        @click="showHeaderDialog = analysisStore.loadHeaderData()"
      />
      <v-btn
        icon="mdi-close"
        color="var(--cancel)"
        @click="emit('closeAnalysisDialog')"
      />
    </v-toolbar>
    <v-progress-linear
      v-hide="!analysisStore.loading || selectedMode !== 'View Mode'"
      rounded
      indeterminate
      stream
      color="var(--success)"
    />
    <div
      v-if="selectedMode === 'View Mode' || selectedMode === ''"
      class="analysis-content"
      @touchstart.passive="handleViewTouchStart"
      @touchend.passive="handleViewTouchEnd"
    >
      <view-mode
        :image="activeImage"
        @previous="requestPreviousImage"
        @next="requestNextImage"
      />
      <div class="side-panel-container">
        <v-sheet
          class="side-panel-item"
          rounded
        >
          <div class="d-flex flex-wrap ga-2 mb-4">
            <v-chip
              v-for="chip in headerChips"
              :key="chip.icon"
              :prepend-icon="chip.icon"
              color="var(--info)"
              :text="chip.text"
            />
          </div>
          <div class="view-mode-meta">
            <div
              v-for="item in viewModeDetails"
              :key="item.label"
              class="view-mode-meta-row"
            >
              <span class="view-mode-meta-label">{{ item.label }}</span>
              <span class="view-mode-meta-value">{{ item.value }}</span>
            </div>
          </div>
        </v-sheet>
      </div>
    </div>
    <div
      v-else-if="selectedMode === 'Analysis Mode'"
      class="analysis-content"
    >
      <image-viewer
        v-model:centroid-tool-active="centroidToolActive"
        :catalog="filteredCatalog"
        :centroid-region="centroidRegion"
        :wcs-solution="wcsSolution"
        @analysis-action="requestAnalysis"
        @centroid-region-updated="handleCentroidRegionUpdated"
      />
      <div class="side-panel-container">
        <v-expand-transition>
          <v-sheet
            v-if="centroidToolActive"
            class="side-panel-item"
          >
            <div class="d-flex align-center justify-space-between mb-3 flex-wrap ga-2">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-vector-circle" />
                <b>Centroiding</b>
              </div>
              <v-chip
                :color="'var(--success)'"
                size="small"
              >
                Tool Active
              </v-chip>
            </div>
            <div class="view-mode-meta mb-3">
              <div class="view-mode-meta-row">
                <span class="view-mode-meta-value">Click the centroid tool, then click and drag on the image to size the linked aperture and background rings.</span>
              </div>
              <div
                v-if="centroidRegion"
                class="view-mode-meta-row"
              >
                <span class="view-mode-meta-label">Current Region</span>
                <span
                  v-if="centroidRegion.ra != null && centroidRegion.dec != null"
                  class="view-mode-meta-value"
                >
                  Center (RA, Dec): {{ centroidRegion.ra.toFixed(6) }}, {{ centroidRegion.dec.toFixed(6) }}
                </span>
                <span class="view-mode-meta-value">
                  Radius: {{ centroidRegion.radius.toFixed(2) }} px
                </span>
                <span class="view-mode-meta-value">
                  Inner annulus: {{ centroidRegion.r_back1.toFixed(2) }} px
                </span> 
                <span class="view-mode-meta-value">
                  Outer annulus: {{ centroidRegion.r_back2.toFixed(2) }} px
                </span>
              </div>
            </div>
            <div class="centroid-legend mb-3">
              <div class="centroid-legend-item">
                <span class="centroid-legend-swatch centroid-legend-swatch--aperture" />
                <span class="view-mode-meta-value">Aperture</span>
              </div>
              <div class="centroid-legend-item">
                <span class="centroid-legend-swatch centroid-legend-swatch--annulus" />
                <span class="view-mode-meta-value">Background-subtracted annulus</span>
              </div>
            </div>
            <v-checkbox
              v-model="usePlaneBackground"
              color="var(--primary-interactive)"
              density="comfortable"
              hide-details
              label="Plane background removal"
            />
            <v-btn
              class="mt-3"
              color="var(--primary-interactive)"
              :disabled="!centroidRegion?.ready"
              @click="requestCentroid"
            >
              Get Centroid
            </v-btn>
            <div
              v-if="centroidResult"
              class="view-mode-meta mt-4"
            >
              <div class="view-mode-meta-row">
                <span class="view-mode-meta-label">Result</span>
                <template v-if="centroidResult.success">
                  <span class="view-mode-meta-value">RA: {{ Number(centroidResult.ra) }}</span>
                  <span class="view-mode-meta-value">Dec: {{ Number(centroidResult.dec) }}</span>
                  <span class="view-mode-meta-value">background: {{ Number(centroidResult.background).toFixed(2) }}</span>
                  <span class="view-mode-meta-value">peak: {{ Number(centroidResult.peak).toFixed(2) }}</span>
                </template>
                <span
                  v-else
                  class="view-mode-meta-value"
                >
                  {{ centroidResult.error || centroidResult.message || 'Centroiding failed.' }}
                </span>
              </div>
            </div>
          </v-sheet>
        </v-expand-transition>
        <v-expand-transition>
          <v-sheet
            v-if="catalog.length"
            class="side-panel-item"
          >
            <div class="d-flex align-center mb-2">
              <v-btn
                class="mr-2"
                variant="text"
                title="Toggle Catalog"
                density="compact"
                icon="mdi-flare"
                :color="userDataStore.catalogToggle ? 'var(--primary-interactive)' : 'var(--disabled-text)'"
                @click="userDataStore.catalogToggle = !userDataStore.catalogToggle"
              />
              <b>{{ filteredCatalog.length }} Sources in flux range</b>
            </div>
            <non-linear-slider
              v-model="fluxSliderRange"
              :disabled="!userDataStore.catalogToggle"
              :max="Math.max(...catalog.map((source) => source.flux))"
              :min="Math.min(...catalog.map((source) => source.flux))"
            />
          </v-sheet>
        </v-expand-transition>
        <v-expand-transition>
          <v-sheet
            v-if="analysisStore.imageScaleReady && scalerReady"
            class="side-panel-item"
            rounded
          >
            <histogram-slider
              :histogram="analysisStore.histogram"
              :bins="analysisStore.bins"
              :max-value="analysisStore.maxPixelValue"
              :z-min="Number(analysisStore.zmin)"
              :z-max="Number(analysisStore.zmax)"
              :color="{ r: 255, g: 255, b: 255 }"
              @update-scaling="updateScaling"
            />
          </v-sheet>
        </v-expand-transition>
        <v-expand-transition>
          <v-sheet
            v-show="lineProfile.length || analysisStore.magTimeSeries.length"
            class="side-panel-item"
          >
            <line-plot
              v-show="lineProfile?.length && sideChart === 'Line Profile'"
              :y-axis-data="lineProfile"
              :x-axis-length="lineProfileLength"
              :start-coords="startCoords"
              :end-coords="endCoords"
              :position-angle="positionAngle"
            />
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
.mode-toggle-center {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  position: absolute;
  top: 16px;
  left: 0;
  z-index: 2100;
  pointer-events: none;
}
.mode-toggle {
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
.mode-toggle :deep(.v-btn) {
  background-color: var(--secondary-background);
  color: var(--text);
}
.mode-toggle :deep(.v-btn--active) {
  background-color: var(--primary-interactive);
  color: var(--text);
}
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
.analysis-toolbar-chips {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}
.analysis-content{
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: 0.5rem;
}
.view-mode-meta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.view-mode-meta-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.view-mode-meta-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--disabled-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.view-mode-meta-value {
  font-size: 0.98rem;
  color: var(--text);
  word-break: break-word;
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

.centroid-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.centroid-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.centroid-legend-swatch {
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 0.125rem;
  flex-shrink: 0;
}

.centroid-legend-swatch--aperture {
  background-color: var(--cancel);
}

.centroid-legend-swatch--annulus {
  background-color: var(--warning);
}

.v-tabs-window{
  margin-top: 0.5rem
}
</style>
