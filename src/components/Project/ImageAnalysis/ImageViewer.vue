<script setup>
import { onMounted, ref, nextTick, computed, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  imageSrc: {
    type: String,
    required: true,
  },
  catalog: {
    type: Array,
    required: false,
    default: null,
  }
})

const emit = defineEmits(['analysisAction'])

const isLoading = ref(true)

const imageContainer = ref(null)
const imageviewercontainer = ref(null)
let image = null
let imageOverlay = null
let imageBounds
let initialCenter = [0, 0]
let initialZoom = 1
let lastDrawnLine = null
let layerControl = null
const imageWidth = ref(0)
const imageWidthContainer = ref(0)
const imageHeight = ref(0)
// const scaledHeight = ref(0)
const scaledWidth = ref(0)

const scaledHeight = computed(() => {
  return imageHeight.value * (scaledWidth.value / imageWidth.value)
})
// const scaledWidth = computed(() => imageWidth.value * 0.7)

const setScaledSizes = () => {
  console.log(imageviewercontainer.value.clientWidth)
  scaledWidth.value = imageviewercontainer.value.clientWidth * 0.98
}

// loads image overlay and set bounds
const loadImageOverlay = () => {
  // Create leaflet map (here referred to as image)
  image = L.map(imageContainer.value, {
    center: [0, 0],
    zoom: 1,
    crs: L.CRS.Simple,
    minZoom: 0,
    dragging: false,
  })

  // Can add new layers to this control and they will be able to be turned on and off in the top right corner of the map
  layerControl = L.control.layers().addTo(image)

  const img = new Image()
  img.onload = () => {
    imageWidth.value = img.width
    imageHeight.value = img.height
    
    // Getting image bounds based on img's size
    imageBounds = [[0, 0], [imageHeight.value, imageWidth.value]] 
    if (imageOverlay) {
      image.removeLayer(imageOverlay)
    }

    fetchCatalog()

    // Add new overlay with correct bounds
    imageOverlay = L.imageOverlay(props.imageSrc, imageBounds).addTo(image)
    // Fit image view to the bounds of the image
    image.fitBounds(imageBounds)
    image.setMaxBounds(imageBounds)

    // waits for DOM to load then recalculates image's size and position after the container's dimensions have changed (built in method of Leaflet)
    nextTick(() => {
      image.invalidateSize()
    })

    initialCenter = image.getCenter()
    initialZoom = image.getZoom()
    isLoading.value = false
  }
  img.src = props.imageSrc
}

function leafletSetup(){
  // Create custom control to reset view after zooming in
  image.pm.Toolbar.createCustomControl({
    name: 'resetView',
    block: 'custom',
    title: 'Reset View',
    className: 'custom-reset-zoom-icon',
    onClick: () => {
      image.setView(initialCenter, initialZoom)
    },
    actions: [],
    toggle: false,
    disabled: false,
  })

  // Disabling default controls
  image.pm.addControls({
    position: 'topleft',
    drawMarker: false,
    drawCircle: false,
    drawCircleMarker: false,
    drawPolygon: false,
    drawText: false,
    drawRectangle: false,
    editMode: true,
    dragMode: true,
    cutPolygon: false,
    rotateMode: false,
    removalMode: true
  })

  const zoomedInThreshold = 1

  // Disable dragging until zoomed in
  image.on('zoomend', () => {
    if (image.getZoom() >= zoomedInThreshold) {
      image.dragging.enable()
    } else {
      image.dragging.disable()
    }
  })

  // Finish line after 2 points (default is multiple points for a line)
  image.on('pm:drawstart', ({ workingLayer }) => {
    // Remove last drawn line when starting new one
    if (lastDrawnLine && image.hasLayer(lastDrawnLine)) {
      image.removeLayer(lastDrawnLine)
    }
    let pointsCount = 0
    workingLayer.on('pm:vertexadded', () => {
      pointsCount++
      if (pointsCount === 2) {
        image.pm.Draw.Line._finishShape()
      }
    })
  })

  // Get coordinates of the line
  image.on('pm:create', (e) => {
    // Save last drawn line
    lastDrawnLine = e.layer
    e.layer.on('pm:edit', handleEdit)
    requestLineProfile(e.layer.getLatLngs())
  })
}

// Checks if the point is within the bounds of the image
function isWithinBounds(point) {
  const latWithinBounds = point.lat >= 0 && point.lat <= imageBounds[1][0]
  const lngWithinBounds = point.lng >= 0 && point.lng <= imageBounds[1][1]
  return latWithinBounds && lngWithinBounds
}

// Adjusts the point to be within the bounds of the image
function adjustToBounds(point) {
  const lat = Math.max(0, Math.min(imageBounds[1][0], point.lat))
  const lng = Math.max(0, Math.min(imageBounds[1][1], point.lng))
  // Returns a new point with adjusted coordinates if the point is outside the bounds
  return L.latLng(lat, lng)
}

// Callback function for when a line is edited and checks if it's within bounds
function handleEdit(event) {
  let latLngs = event.layer.getLatLngs()

  // Checking if the line is within the bounds
  const adjustedLatLngs = latLngs.map(point => {
    return isWithinBounds(point) ? point : adjustToBounds(point)
  })

  // Removes the existing layer from the image
  image.removeLayer(event.layer)

  // Creates a new line with the adjusted coordinates
  const newLine = L.polyline(adjustedLatLngs)
  newLine.addTo(image)

  // Re-enable editing and attach the edit handler
  newLine.pm.enable({
    allowSelfIntersection: false,
  })

  // Set this new line as the last drawn line if you're tracking that
  lastDrawnLine = newLine

  // Re-attach the edit handling logic
  newLine.on('pm:edit', handleEdit)

  requestLineProfile(event.layer.getLatLngs())
}

function requestLineProfile(latLngs) {
  // Check that there are two points to calculate the line length
  if (latLngs.length < 2) return

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

function createCatalogLayer(){
  if (!props.catalog) return

  let catalogMarkers = []

  props.catalog.forEach((source) => {
    let sourceMarker = L.circle([source.y, source.x], {
      color: 'var(--tangerine)',
      fillColor: 'var(--tangerine)',
      fillOpacity: 0.2,
      radius: 10
    })

    sourceMarker.bindPopup(`Flux: ${source.flux}<br>Ra: ${source.ra}<br>Dec: ${source.dec}`)
    catalogMarkers.push(sourceMarker)
  })

  let catalogLayerGroup = L.layerGroup(catalogMarkers)
  layerControl.addOverlay(catalogLayerGroup, 'Source Catalog')
}

function fetchCatalog(){
  const catalogInput = {
    width: imageWidth.value,
    height: imageHeight.value
  }
  emit('analysisAction', 'source-catalog', catalogInput)
}

watch(() => props.catalog, () => {
  createCatalogLayer()
})

onMounted(() => {
  loadImageOverlay()
  leafletSetup()
  setScaledSizes()
})

</script>


<template>
  <div
    ref="imageviewercontainer"
    class="column is-two-thirds"
  >
    <div
      v-if="isLoading"
      class="image-loading-container"
    >
      <v-progress-circular
        indeterminate
        model-value="20"
        :size="50"
        :width="9"
      />
    </div>
    <div
      ref="imageContainer"
      class="leaflet-map-container"
      :style="{ width: scaledWidth + 'px', height: scaledHeight + 'px' }"
    />
  </div>
</template>
<style>
.leaflet-map-container .marker-icon-middle {
  display: none !important;
}
.custom-reset-zoom-icon {
  background-image: url('../../../assets/images/stock-vector-arrows-of-four-directions-linear-icon-black-symbol-on-transparent-background-1277674303.png');
  background-size: 24px 24px;
  background-repeat: no-repeat;
  background-position: center;
  width: 24px;
  height: 24px;
}
</style>
<style scoped>
.wrapper{
  background-color: var(--dark-blue);
}
.leaflet-map-container {
  background-color: transparent;
  margin-left: 2%;
  margin-top: 2%;
}
.leaflet-image-layer {
  width: 100% !important;
  height: 100% !important;
}
.leaflet-tooltip {
  display: none !important;
}
.button-container.active .leaflet-pm-actions-container {
  display: none !important;
}
@media (max-width: 1200px) {
  .wrapper {
    overflow: visible;
  }
  .leaflet-map-container{
    transform: scale(0.6);
    transform-origin: top left;
    background-color: transparent;
  }
}
@media (max-width: 900px) {
  .wrapper {
    overflow: visible;
    margin-left: 10%;
  }
  .leaflet-map-container{
    transform: scale(0.7);
    transform-origin: top left;
    background-color: transparent;
  }
}
</style>
