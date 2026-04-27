<script setup>
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { loadImage, scalePoint } from '@/utils/common'
import WCS from '@/utils/wcs'

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
  },
  centroidRegion: {
    type: Object,
    required: false,
    default: null,
  }
})

const centroidToolActive = defineModel('centroidToolActive', {
  type: Boolean,
  default: false,
})

const emit = defineEmits(['analysisAction', 'centroidRegionUpdated'])

const CENTROID_DEFAULTS = {
  radius: 6,
  r_back1: 10,
  r_back2: 15,
}
const MIN_CENTROID_RADIUS = 3

// Leaflet map
let imageMap = null
let imageBounds = null
let imageOverlay = null
let lineLayer = null
let wcs = null
let catalogLayerGroup = null
let centroidOverlay = null
let centroidDrawStart = null
let wasMapDraggingEnabled = false
let imageDimensions = ref({ width: 0, height: 0 })
const leafletDiv = ref(null)
const isHoveringLeaflet = ref(false)
const raDec = ref({ ra: 0, dec: 0 })
const isLeafletDrawToolActive = ref(false)
const alerts = useAlertsStore()
const analysisStore = useAnalysisStore()
let viewerInstanceId = 0

onMounted(() => {
  // Initialize the map and its event listeners before adding the image overlay
  createMap()
  addMapHandlers()

  if (analysisStore.imageUrl) {
    initImageOverlay(analysisStore.imageUrl)
  }

  if (props.catalog?.length) {
    createCatalogLayer()
  }
})

onUnmounted(() => {
  viewerInstanceId += 1

  if (imageMap) {
    imageMap.off()
    imageMap.remove()
  }

  imageMap = null
  imageBounds = null
  imageOverlay = null
  lineLayer = null
  wcs = null
  catalogLayerGroup = null
  centroidOverlay = null
  centroidDrawStart = null
})

// When the catalog is updated we want to recreate the catalog layer
watch(() => props.catalog, () => createCatalogLayer())

watch(() => props.centroidRegion, (newRegion) => {
  syncCentroidOverlay(newRegion)
}, { deep: true })

watch(centroidToolActive, (newValue) => {
  if (!newValue) {
    centroidDrawStart = null
  }
  syncCentroidToolControl()
}, { immediate: true })

// update url property of the ImageOverlay Layer or create it
watch(() => analysisStore.imageUrl, (newImageUrl) => {
  if (!newImageUrl || !imageMap) return

  imageOverlay ? imageOverlay.setUrl(newImageUrl) : initImageOverlay(newImageUrl)
})

// Creates image overlay and sets bounds
async function initImageOverlay(imgSrc) {
  if (!imgSrc || !imageMap) return

  const instanceId = viewerInstanceId
  const img = await loadImage(imgSrc)

  if (instanceId !== viewerInstanceId || !imageMap) return

  imageDimensions.value = { width: img.width, height: img.height }

  // Fetch catalog only if empty
  if (!props.catalog?.length){
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
   * Next tick is used here otherwise the bounds will update before the ImageOverlay is added to the map
   */
  nextTick(() => {
    if (!imageMap) return

    imageMap.invalidateSize()
    imageMap.fitBounds(imageBounds)
    imageMap.setMaxBounds(imageBounds)
    imageMap.setMinZoom(imageMap.getZoom())
  })
}

function createMap(){
  // Create leaflet map (here referred to as imageMap)
  imageMap = L.map(leafletDiv.value, {
    maxZoom: 5,
    minZoom: -3,
    zoomSnap: 0, // disable snap for smooth zoom
    zoomDelta: 0.5,
    crs: L.CRS.Simple,
    attributionControl: false,
    maxBoundsViscosity: 1.0, // Prevents panning outside of image
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

  imageMap.pm.Toolbar.createCustomControl({
    name: 'centroidTool',
    block: 'custom',
    title: 'Centroid Tool',
    className: 'custom-centroid-tool-icon',
    onClick: toggleCentroidTool,
    actions: [],
    toggle: false,
  })

  nextTick(() => {
    syncCentroidToolControl()
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
  const mapContainer = imageMap.getContainer()

  // Remove last drawn line when starting new one
  imageMap.on('pm:drawstart', ({ workingLayer }) => {
    isLeafletDrawToolActive.value = true
    centroidDrawStart = null
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
    isLeafletDrawToolActive.value = false
    lineLayer = e.layer
    requestLineProfile(lineLayer.getLatLngs())
  })

  imageMap.on('pm:drawend', () => {
    isLeafletDrawToolActive.value = false
  })

  // Handler for displaying ra, dec coordinates when hovering over the image
  imageMap.on('mousemove', (e) => {
    handleCentroidDrag(e)

    // If we don't have a WCS solution, we can't display coordinates
    if(!props.wcsSolution) return

    // Initialize WCS helper class if not already done
    if(!wcs){
      const { crval, crpix, cd1, cd2, fits_dimensions } = props.wcsSolution
      wcs = new WCS(crval[0], crval[1], crpix[0], crpix[1], cd1[0], cd1[1], cd2[0], cd2[1], fits_dimensions)
    }

    const fitsWidth = wcs.fits_dimensions[0]
    const fitsHeight = wcs.fits_dimensions[1]

    // TODO: up to here might be able to be moved outside of the mousemove event

    const imageX = e.latlng.lng
    const imageY = e.latlng.lat

    const {x, y} = scalePoint(imageDimensions.value.width, imageDimensions.value.height, fitsWidth, fitsHeight, imageX, imageY)

    const ra = wcs.pixelToRa(x, y)
    const dec = wcs.pixelToDec(x, y)
    raDec.value = { ra, dec }
  })

  imageMap.on('mousedown', handleCentroidStart)
  imageMap.on('mouseup', handleCentroidEnd)
  imageMap.on('mouseout', handleCentroidEnd)
  mapContainer.addEventListener('touchstart', handleCentroidTouchStart, { passive: false })
  mapContainer.addEventListener('touchmove', handleCentroidTouchMove, { passive: false })
  mapContainer.addEventListener('touchend', handleCentroidTouchEnd, { passive: false })
  mapContainer.addEventListener('touchcancel', handleCentroidTouchEnd, { passive: false })
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
  if (!imageMap || !Array.isArray(props.catalog) || !props.catalog.length) {
    return
  }

  // Function to create a marker for a source
  function createSourceMarker(source){
    // Marker popup text
    const div = document.createElement('div')
    div.innerHTML = `
      <b>Flux:</b> ${source.flux ?? 'N/A'}<br>
      <b>RA:</b> ${source.ra ?? 'N/A'}<br>
      <b>Dec:</b> ${source.dec ?? 'N/A'}<br>
    `
    // Create a circle marker for the source
    return new L.Circle([source.y_win, source.x_win], {
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

function toggleCentroidTool() {
  centroidToolActive.value = !centroidToolActive.value
  centroidDrawStart = null
  imageMap?.pm?.disableDraw?.()
}

function syncCentroidToolControl() {
  const centroidToolButton = leafletDiv.value?.querySelector('.custom-centroid-tool-icon')

  if (!centroidToolButton) {
    return
  }

  const resetToolContainer = leafletDiv.value?.querySelector('.custom-reset-zoom-icon')?.closest('.button-container')
  const centroidToolContainer = centroidToolButton.closest('.button-container')

  resetToolContainer?.classList.add('custom-tool-container')
  centroidToolButton.classList.toggle('centroid-tool-active', centroidToolActive.value)
  centroidToolButton.classList.toggle('active', centroidToolActive.value)
  centroidToolButton.classList.remove('leaflet-disabled')
  centroidToolContainer?.classList.add('custom-tool-container')
  centroidToolContainer?.classList.toggle('centroid-tool-active', centroidToolActive.value)
  centroidToolContainer?.classList.toggle('active', centroidToolActive.value)
}

function emitCentroidRegionUpdated(region) {
  emit('centroidRegionUpdated', region ? { ...region } : null)
}

function centroidDistance(center, point) {
  const dx = point.lng - center.lng
  const dy = point.lat - center.lat
  return Math.sqrt(dx * dx + dy * dy)
}

function latLngFromTouchEvent(event) {
  const touch = event.touches[0] || event.changedTouches[0]
  if (!touch || !imageMap) {
    return null
  }

  const rect = imageMap.getContainer().getBoundingClientRect()
  const containerPoint = L.point(touch.clientX - rect.left, touch.clientY - rect.top)
  return imageMap.containerPointToLatLng(containerPoint)
}

function buildCentroidRegion(center, rawRadius) {
  const radius = Math.max(rawRadius, MIN_CENTROID_RADIUS)

  return {
    x: center.lng,
    y: center.lat,
    ra: null,
    dec: null,
    radius,
    r_back1: radius * (CENTROID_DEFAULTS.r_back1 / CENTROID_DEFAULTS.radius),
    r_back2: radius * (CENTROID_DEFAULTS.r_back2 / CENTROID_DEFAULTS.radius),
    width: imageDimensions.value.width,
    height: imageDimensions.value.height,
    ready: true,
  }
}

function handleCentroidStart(event) {
  if (!centroidToolActive.value || isLeafletDrawToolActive.value || !imageMap || !imageBounds) {
    return
  }

  wasMapDraggingEnabled = imageMap.dragging.enabled()
  if (wasMapDraggingEnabled) {
    imageMap.dragging.disable()
  }

  centroidDrawStart = event.latlng
  const region = buildCentroidRegion(event.latlng, MIN_CENTROID_RADIUS)
  syncCentroidOverlay(region)
  emitCentroidRegionUpdated(region)
}

function handleCentroidDrag(event) {
  if (!centroidToolActive.value || isLeafletDrawToolActive.value || !centroidDrawStart) {
    return
  }

  const region = buildCentroidRegion(
    centroidDrawStart,
    centroidDistance(centroidDrawStart, event.latlng),
  )

  syncCentroidOverlay(region)
  emitCentroidRegionUpdated(region)
}

function handleCentroidEnd() {
  if (!centroidDrawStart) {
    return
  }

  centroidDrawStart = null
  if (wasMapDraggingEnabled) {
    imageMap.dragging.enable()
  }
  wasMapDraggingEnabled = false
}

function handleCentroidTouchStart(event) {
  const latlng = latLngFromTouchEvent(event)
  if (!latlng) {
    return
  }

  event.preventDefault()
  handleCentroidStart({ latlng })
}

function handleCentroidTouchMove(event) {
  if (!centroidDrawStart) {
    return
  }

  const latlng = latLngFromTouchEvent(event)
  if (!latlng) {
    return
  }

  event.preventDefault()
  handleCentroidDrag({ latlng })
}

function handleCentroidTouchEnd(event) {
  if (!centroidDrawStart) {
    return
  }

  event.preventDefault()
  handleCentroidEnd()
}

function syncCentroidOverlay(region) {
  if (!imageMap) {
    return
  }

  if (!region) {
    if (centroidOverlay && imageMap.hasLayer(centroidOverlay)) {
      imageMap.removeLayer(centroidOverlay)
    }
    centroidOverlay = null
    return
  }

  const center = [region.y, region.x]
  const layers = [
    L.circleMarker(center, {
      radius: 4,
      color: 'var(--text)',
      fillColor: 'var(--text)',
      fillOpacity: 1,
      weight: 1,
      pmIgnore: true,
    }),
    L.circle(center, {
      radius: region.radius,
      color: 'var(--cancel)',
      fill: false,
      weight: 2,
      pmIgnore: true,
    }),
    L.circle(center, {
      radius: region.r_back1,
      color: 'var(--warning)',
      fill: false,
      dashArray: '6 4',
      weight: 2,
      pmIgnore: true,
    }),
    L.circle(center, {
      radius: region.r_back2,
      color: 'var(--warning)',
      fill: false,
      dashArray: '3 4',
      weight: 2,
      pmIgnore: true,
    }),
  ]

  if (centroidOverlay) {
    centroidOverlay.clearLayers()
    layers.forEach((layer) => centroidOverlay.addLayer(layer))
    return
  }

  centroidOverlay = new L.LayerGroup(layers)
  centroidOverlay.addTo(imageMap)
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
        RA: {{ raDec.ra.toFixed(6) }}, Dec: {{ raDec.dec.toFixed(6) }}
      </v-chip>
    </v-fade-transition>
  </div>
</template>
<style>

/* Custom icons for leaflet-geoman */
.leaflet-top.leaflet-left{
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap;
  width: max-content;
  max-width: calc(100% - 1rem);
  margin: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.leaflet-control-zoom {
  display: flex;
  flex-direction: row-reverse
}

.custom-reset-zoom-icon {
  background-image: url('../../assets/images/resize.svg');
  filter: invert(1);
}

.custom-centroid-tool-icon {
  background-image: url('../../assets/images/vector-circle.svg');
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

.button-container.custom-tool-container {
  width: auto !important;
  display: inline-flex;
}

.leaflet-bar a.custom-centroid-tool-icon {
  background-color: var(--primary-interactive);
}

.leaflet-bar a.custom-centroid-tool-icon.centroid-tool-active,
.leaflet-bar a.custom-centroid-tool-icon.active,
.button-container.centroid-tool-active a.custom-centroid-tool-icon {
  background-color: var(--warning);
}

.leaflet-top.leaflet-left .leaflet-pm-toolbar.leaflet-bar a {
  border-bottom: none;
  border-right: 1px solid var(--secondary-background);
}

.leaflet-top.leaflet-left .leaflet-pm-toolbar.leaflet-bar a:last-child {
  border-right: none;
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
  user-select: none;
  -webkit-user-select: none;
}

</style>
