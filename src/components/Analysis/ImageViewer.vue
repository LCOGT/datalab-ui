<script setup>
import { onMounted, ref, nextTick, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { loadImage, scalePoint } from '@/utils/common'
import WCS from '@/utils/wcs'
import VariableStarDialog from './VariableStarDialog.vue'

const props = defineProps({
  catalog: {
    type: Array,
    required: false,
    default: null,
  },
  wcsSolution: {
    type: Object,
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
let wcs = null
let catalogLayerGroup = null
let imageDimensions = ref({ width: 0, height: 0 })
const leafletDiv = ref(null)
const isHoveringLeaflet = ref(false)
const raDec = ref({ ra: 0, dec: 0 })
const alerts = useAlertsStore()
const analysisStore = useAnalysisStore()
const showVariableStarDialog = ref(false)
const variableTargetCoords = ref({ ra: null, dec: null })

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
  imageDimensions.value = { width: img.width, height: img.height }

  // Fetch catalog only if empty
  if (!props.catalog.length){
    const catalogInput = {
      width: imageDimensions.value.width,
      height: imageDimensions.value.height,
    }
    emit('analysisAction', 'source-catalog', catalogInput)
  }

  // Fetch WCS data for pix to world transformation
  emit('analysisAction', 'wcs')

  imageBounds = [[0, 0], [imageDimensions.value.height, imageDimensions.value.width]]
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

  // Handler for displaying ra, dec coordinates when hovering over the image
  imageMap.on('mousemove', (e) => {
    // If we don't have a WCS solution, we can't display coordinates
    if(!props.wcsSolution) return

    // Initialize WCS helper class if not already done
    if(!wcs){
      const { crval, crpix, cd1, cd2, fits_dimensions } = props.wcsSolution
      wcs = new WCS(crval[0], crval[1], crpix[0], crpix[1], cd1[0], cd1[1], cd2[0], cd2[1], fits_dimensions)
    }

    setTimeout(() => {
      const fitsWidth = wcs.fits_dimensions[0]
      const fitsHeight = wcs.fits_dimensions[1]

      const imageX = e.latlng.lng
      const imageY = e.latlng.lat

      const {x, y} = scalePoint(imageDimensions.value.width, imageDimensions.value.height, fitsWidth, fitsHeight, imageX, imageY)

      const ra = wcs.pixelToRa(x, y)
      const dec = wcs.pixelToDec(x, y)
      raDec.value = { ra, dec }
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

  const lineProfileInput = {
    x1: latLngs[0].lat,
    y1: latLngs[0].lng,
    x2: latLngs[1].lat,
    y2: latLngs[1].lng,
    ...imageDimensions.value
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
      <button class="variableAnalysisButton">Light Curve</button>
    `

    div.querySelector('button').addEventListener('click',() => {
      showVariableStarDialog.value = true
      variableTargetCoords.value = {
        ra: source.ra,
        dec: source.dec
      }
    })

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
    class="position-relative"
    :style="{ width: imageDimensions.width + 'px' }"
    @mouseenter="isHoveringLeaflet = true"
    @mouseleave="isHoveringLeaflet = false"
  >
    <v-fade-transition>
      <v-chip
        v-show="isHoveringLeaflet && props.wcsSolution"
        :style="{ zIndex: 2000, color: 'var(--text)' }"
        class="position-absolute ma-2 top-0 right-0 elevation-2"
        color="var(--primary-interactive)"
        variant="flat"
        prepend-icon="mdi-crosshairs"
      >
        Ra: {{ raDec.ra.toFixed(6) }}, Dec: {{ raDec.dec.toFixed(6) }}
      </v-chip>
    </v-fade-transition>
  </div>
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
