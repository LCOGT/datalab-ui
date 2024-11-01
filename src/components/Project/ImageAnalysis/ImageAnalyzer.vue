<script setup>
import { ref } from 'vue'
import { fetchApiCall } from '../../../utils/api'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import ImageViewer from './ImageViewer.vue'
import LinePlot from './LinePlot.vue'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import ImageDownloadMenu from '@/components/Project/ImageAnalysis/ImageDownloadMenu.vue'
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
const catalog = ref([])
const positionAngle = ref()
const headerDialog = ref(false)
const headerData = ref({})

function closeDialog() {
  lineProfile.value = []
  lineProfileLength.value = 0
  startCoords.value = null
  endCoords.value = null
  headerData.value = null
  emit('update:modelValue', false)
}

// This function runs when imageViewer emits an analysis-action event and should be extended to handle other analysis types
function requestAnalysis(action, input, action_callback=null){
  const url = configStore.datalabApiBaseUrl + 'analysis/' + action + '/'
  const body = {
    'basename': props.image.basename,
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

function showHeaderDialog() {

  if(headerData.value && Object.keys(headerData.value).length > 0) {
    headerDialog.value = true
    return
  }

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

</script>
<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
  >
    <v-sheet class="analysis-sheet">
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
          :image="image"
          @analysis-action="requestAnalysis"
        />
        <v-btn
          icon="mdi-information"
          @click="showHeaderDialog"
        />
        <v-btn
          icon="mdi-close"
          @click="closeDialog()"
        />
      </v-toolbar>
      <div class="analysis-content">
        <image-viewer
          :image-src="image.largeCachedUrl"
          :catalog="catalog"
          @analysis-action="requestAnalysis"
        />
        <div class="side-panel-container">
          <v-sheet
            v-if="image.site_id || image.telescope_id || image.instrument_id || image.observation_date"
            rounded
            class="side-panel"
          >
            <p><v-icon icon="mdi-earth" /> {{ siteIDToName(image.site_id) ?? 'Missing Site' }}</p>
            <p><v-icon icon="mdi-telescope" /> {{ image.telescope_id ?? 'Missing Telescope ID' }}</p>
            <p><v-icon icon="mdi-camera" /> {{ image.instrument_id ?? 'Missing Instrument ID' }} </p>
            <p><v-icon icon="mdi-clock" /> {{ new Date(image.observation_date).toLocaleString() }}</p>
          </v-sheet>
          <line-plot
            :y-axis-luminosity="lineProfile"
            :x-axis-arcsecs="lineProfileLength"
            :start-coords="startCoords"
            :end-coords="endCoords"
            :position-angle="positionAngle"
          />
        </div>
      </div>
    </v-sheet>
  </v-dialog>
  <v-dialog
    v-model="headerDialog"
    width="auto"
  >
    <v-sheet class="pa-12">
      <h1 class="mb-8">
        FITS Headers
      </h1>
      <v-table>
        <tbody>
          <tr
            v-for="(value, key) in headerData"
            :key="key"
          >
            <td class="table_key">
              {{ key }}
            </td>
            <td>{{ value }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-sheet>
  </v-dialog>
</template>
<style scoped>
a{
  color: var(--tan);
}
.v-sheet{
  background-color: var(--metal);
  color: var(--tan);
}
.v-table{
  background-color: var(--metal);
  color: var(--tan);
  max-width: 60ch;
}
.table_key{
  font-weight: bold;
  font-size: large;
}
.analysis-sheet{
  background-color: var(--dark-blue);
  font-family: 'Open Sans', sans-serif;
  text-transform: uppercase;
}
.analysis-toolbar{
  color: var(--tan);
  background-color: var(--metal);
}
.analysis-content{
  display: flex;
  width: 100%;
  height: 100%;
}
.side-panel-container {
  margin-top: 2%;
  display: flex;
  flex-direction: column
}
.side-panel{
  padding: 1rem;
  color: var(--tan);
  margin-left: 10px;
  margin-bottom: 5%;
}
@media (min-width: 1201px) {
  .side-panel-container {
    margin-left: 20%;
  }
}
@media (max-width: 1200px) {
.analysis-sheet {
  overflow: hidden !important;
}
.side-panel {
  font-size: 0.75em;
}
}
@media (max-width: 900px) {
.analysis-sheet {
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
}
.analysis-content {
  flex-direction: column;
}
.side-panel-container {
  margin-left: 11%;
  margin-top: 5%;
  flex-direction: row;
  height: 30%;
}
.side-panel {
  width: 25%;
  height: 50%;
  margin: 0;
}
.line-plot {
  flex-grow: 1;
  height: 100%;
}
.image-viewer {
  order: -1;
  height: 70%;
}
}

</style>
