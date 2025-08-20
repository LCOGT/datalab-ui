<script setup>
import { onMounted, ref, nextTick, watch, computed } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { loadImage } from '@/utils/common'
import VariableStarDialog from './VariableStarDialog.vue'

const props = defineProps({
  catalog: {
    type: Array,
    required: false,
    default: null,
  }
})

const emit = defineEmits(['analysisAction'])

// Leaflet map
let imageMap = null
let imageBounds = null
let imageOverlay = null
let lineLayer = null
let catalogLayerGroup = null
const imageWidth = ref(0)
const imageHeight = ref(0)
const leafletDiv = ref(null)
// Hover chip
const isHoveringLeaflet = ref(false)
const mousePos = ref({ x: 0, y: 0 })
const latlng = ref({ lat: 0, lng: 0 })
const alerts = useAlertsStore()
const analysisStore = useAnalysisStore()
const showVariableStarDialog = ref(false)
const variableTargetCoords = ref({ ra: null, dec: null })

const chipStyle = computed(() => {
  return {
    position: 'fixed',
    left: `${mousePos.value.x}px`,
    top: `${mousePos.value.y}px`,
    zIndex: 2000,
  }
})

onMounted(() => {
  createMap()
  addMapHandlers()
})

watch(() => props.catalog, () => createCatalogLayer())

watch(() => analysisStore.imageUrl, (newImageUrl) => {
  imageOverlay ? imageOverlay.setUrl(newImageUrl) : initImageOverlay(newImageUrl)
})

// Loads image overlay and sets bounds
async function initImageOverlay(imgSrc) {
  const img = await loadImage(imgSrc)
  imageWidth.value = img.width
  imageHeight.value = img.height

  // Fetch catalog only if empty
  if (!props.catalog.length){
    const catalogInput = {
      width: imageWidth.value,
      height: imageHeight.value
    }
    emit('analysisAction', 'source-catalog', catalogInput)
  }

  imageBounds = [[0, 0], [imageHeight.value, imageWidth.value]]
  imageOverlay = L.imageOverlay(imgSrc, imageBounds).addTo(imageMap)

  /**
   * Fills map space with image, set max/min zoom
   * Next tick is used here otherwise the methods will not work due to bugs in leaflets code.
   */
  nextTick(() => {
    imageMap.invalidateSize()
    imageMap.fitBounds(imageBounds)
    imageMap.setMaxBounds(imageBounds)
    imageMap.setMinZoom(imageMap.getZoom())
  })
}

function createMap(){
  // Create leaflet map (here referred to as image)
  imageMap = L.map(leafletDiv.value, {
    maxZoom: 5,
    minZoom: -3,
    zoomSnap: 0,
    zoomDelta: 0.5,
    crs: L.CRS.Simple,
    attributionControl: false,
    maxBoundsViscosity: 1.0,
  })

  // Create custom control to reset view after zooming in
  imageMap.pm.Toolbar.createCustomControl({
    name: 'resetView',
    block: 'custom',
    title: 'Reset View',
    className: 'custom-reset-zoom-icon',
    onClick: () => {
      imageMap.fitBounds(imageBounds)
    },
    actions: [],
    toggle: false,
  })

  // Geoman settings
  imageMap.pm.setGlobalOptions({
    hideMiddleMarkers: true,
  })

  // Geoman controls
  imageMap.pm.addControls({
    position: 'topleft',
    drawMarker: false,
    drawCircle: false,
    drawCircleMarker: false,
    drawPolygon: false,
    drawText: false,
    drawRectangle: false,
    editMode: false,
    dragMode: false,
    cutPolygon: false,
    rotateMode: false,
    removalMode: false
  })
}

function addMapHandlers() {
  imageMap.on('pm:drawstart', ({ workingLayer }) => {
    // Remove last drawn line when starting new one
    if (lineLayer && imageMap.hasLayer(lineLayer)) {
      imageMap.removeLayer(lineLayer)
    }
    // Limit line to 2 points
    workingLayer.on('pm:vertexadded', () => {
      if (imageMap.pm.Draw.Line._markers.length === 2) {
        imageMap.pm.Draw.Line._finishShape()
      }
    })
  })

  // Requests a Line Profile when a line is drawn/edited
  imageMap.on('pm:create', (e) => {
    lineLayer = e.layer
    requestLineProfile(lineLayer.getLatLngs())
  })

  imageMap.on('mousemove', (e) => {
    //console.log(e.originalEvent)
    //console.log(e.latlng.lat, e.latlng.lng)
    const mouseMove = e.originalEvent
    // Add a slight delay for a "following" effect
    setTimeout(() => {
      mousePos.value = { x: mouseMove.pageX, y: mouseMove.pageY }
      latlng.value = { lat: e.latlng.lat, lng: e.latlng.lng }
    }, 20)
  })
}

// Event handler for drawn lines, emits an action that will trigger an api call in the parent
function requestLineProfile(latLngs) {
  // Check that there are two points to calculate the line length
  if (latLngs.length != 2){
    alerts.setAlert('error', 'Cannot calculate line profile without two points')
    return
  }

  const startCoordinates = { x1: latLngs[0].lat, y1: latLngs[0].lng }
  const endCoordinates = { x2: latLngs[1].lat, y2: latLngs[1].lng }
  const imageSize = {width: imageWidth.value, height: imageHeight.value}

  const lineProfileInput = {
    ...startCoordinates,
    ...endCoordinates,
    ...imageSize
  }

  emit('analysisAction', 'line-profile', lineProfileInput)
}

// When we get the catalog data this creates a layer of circles on the map
function createCatalogLayer(){
  // Function to create a marker for a source
  function createSourceMarker(source){
    // Marker popup text
    const div = document.createElement('div')
    div.innerHTML = `
      <b>Flux:</b> ${source.flux ?? 'N/A'}<br>
      <b>Ra:</b> ${source.ra ?? 'N/A'}<br>
      <b>Dec:</b> ${source.dec ?? 'N/A'}<br>
    `
    // Marker popup button for variable star analysis
    const button = document.createElement('button')
    button.innerHTML = 'Light Curve'
    button.className = 'variableAnalysisButton'
    button.addEventListener('click',() => {
      showVariableStarDialog.value = true
      variableTargetCoords.value = {
        ra: source.ra,
        dec: source.dec
      }
    })

    div.appendChild(button)

    // Create a circle marker for the source
    return new L.Circle([source.y, source.x], {
      color: 'var(--info)',
      fillOpacity: 0.2,
      radius: 3,
      pmIgnore: true, // Ignore this layer for editing
      snapIgnore: false, // Allow snapping to this layer
    }).bindPopup(div)
  }

  const sourceCatalogMarkers = props.catalog.map(createSourceMarker)

  // update or create the catalog layer group
  if (catalogLayerGroup) {
    catalogLayerGroup.clearLayers()
    sourceCatalogMarkers.forEach((marker) => catalogLayerGroup.addLayer(marker))
  } else {
    catalogLayerGroup = new L.LayerGroup(sourceCatalogMarkers)
    catalogLayerGroup.addTo(imageMap)
  }
}

</script>
<template>
  <div
    ref="leafletDiv"
    :style="{ width: imageWidth + 'px' }"
    @mouseenter="isHoveringLeaflet = true"
    @mouseleave="isHoveringLeaflet = false"
  />
  <v-chip
    v-show="isHoveringLeaflet"
    :style="chipStyle"
    color="var(--info)"
  >
    Ra: {{ latlng.lat }}, Dec: {{ latlng.lng }}
  </v-chip>
  <v-dialog
    v-model="showVariableStarDialog"
    width="600px"
  >
    <variable-star-dialog
      :coords="variableTargetCoords"
      @analysis-action="(action, input) => emit('analysisAction', action, input)"
      @close-dialog="showVariableStarDialog = false"
    />
  </v-dialog>
</template>
<style>
/* Custom icons for leaflet-geoman */
.custom-reset-zoom-icon {
  background-image: url('../../assets/images/resize.svg');
  filter: invert(1);
}

.leaflet-pm-toolbar .leaflet-pm-icon-polyline {
  background-image: url('../../assets/images/vector-line.svg');
  filter: invert(1);
}
/* Custom styling for toolbar */

.leaflet-bar a{
  background-color: var(--primary-interactive);
  color: var(--text);
  border-bottom: none;
}

.leaflet-bar a:hover{
  background-color: var(--secondary-interactive);
}

.leaflet-bar a:focus{
  background-color: var(--secondary-interactive);
}

.leaflet-bar a.leaflet-disabled{
  background-color: var(--secondary-background);
  color: var(--disabled-text);
}

.button-container .leaflet-pm-actions-container .leaflet-pm-action:hover{
  background-color: var(--secondary-interactive);
}

.button-container .leaflet-pm-actions-container .leaflet-pm-action{
  background-color: var(--primary-interactive);
  color: var(--text);
}

.leaflet-container {
  background-color: var(--primary-background);
  border-radius: 0.25rem;
}

.variableAnalysisButton {
  background-color: var(--primary-interactive);
  color: var(--text);
  border: none;
  padding: 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
}
</style>
<style scoped>
</style>
