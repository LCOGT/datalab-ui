<script setup>
import { onMounted, ref, nextTick, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { loadImage } from '@/utils/common'

const props = defineProps({
  catalog: {
    type: Array,
    required: false,
    default: null,
  }
})

const emit = defineEmits(['analysisAction'])

let imageMap = null
let imageBounds = null
let imageOverlay = null
let lineLayer = null
let catalogLayerGroup = null
const imageWidth = ref(0)
const imageHeight = ref(0)
const leafletDiv = ref(null)
const alerts = useAlertsStore()
const analysisStore = useAnalysisStore()

onMounted(() => {
  leafletSetup()
})

watch(() => props.catalog, () => createCatalogLayer())

watch(() => analysisStore.imageUrl, async (newImageUrl) => {
  imageOverlay ? imageOverlay.setUrl(newImageUrl) : initImageOverlay(newImageUrl)
})

// Loads image overlay and sets bounds
async function initImageOverlay(imgSrc) {
  const img = await loadImage(imgSrc)
  imageWidth.value = img.width
  imageHeight.value = img.height

  // Fetch catalog only if empty
  if (!props.catalog.length) fetchCatalog()

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

function leafletSetup(){
  console.log('leafletSetup creating map, controls, listeners')
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
    editMode: true,
    dragMode: false,
    cutPolygon: false,
    rotateMode: false,
    removalMode: true
  })

  // Logic to only allow the user to draw one line with two points
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
    // Save last drawn line
    lineLayer = e.layer
    lineLayer.on('pm:edit', handleEdit)
    requestLineProfile(lineLayer.getLatLngs())
  })
}

// Adjusts the point to be within the bounds of the image
function adjustToBounds(point) {
  const lat = Math.max(0, Math.min(imageBounds[1][0], point.lat))
  const lng = Math.max(0, Math.min(imageBounds[1][1], point.lng))
  return L.latLng(lat, lng)
}

// Adjust edited lines to bounds and requests line profile
function handleEdit() {
  const boundedLatLngs = lineLayer.getLatLngs().map(adjustToBounds)
  lineLayer.setLatLngs(boundedLatLngs)
  requestLineProfile(lineLayer.getLatLngs())
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
    return new L.Circle([source.y, source.x], {
      color: 'var(--info)',
      fillOpacity: 0.2,
      radius: 10,
      pmIgnore: true, // Ignore this layer for editing
      snapIgnore: false, // Allow snapping to this layer
    }).bindPopup(`Flux: ${source.flux ?? 'N/A'}<br>Ra: ${source.ra ?? 'N/A'}<br>Dec: ${source.dec ?? 'N/A'}`)
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

function fetchCatalog(){
  const catalogInput = {
    width: imageWidth.value,
    height: imageHeight.value
  }
  emit('analysisAction', 'source-catalog', catalogInput)
}

</script>
<template>
  <div
    ref="leafletDiv"
    :style="{ width: imageWidth + 'px' }"
  />
</template>
<style>
/* Custom icons for leaflet-geoman */
.custom-reset-zoom-icon {
  background-image: url('../../assets/images/resize.svg');
  filter: invert(1);
}

.leaflet-pm-toolbar .leaflet-pm-icon-delete {
  background-image: url('../../assets/images/delete.svg');
  filter: invert(1);
}

.leaflet-pm-toolbar .leaflet-pm-icon-polyline {
  background-image: url('../../assets/images/vector-line.svg');
  filter: invert(1);
}

.leaflet-pm-toolbar .leaflet-pm-icon-edit {
  background-image: url('../../assets/images/vector-polyline-edit.svg');
  filter: invert(1); /* Adjust the color of the background image */
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
</style>
<style scoped>
</style>
