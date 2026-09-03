<script setup>
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import '@/assets/css/image-viewer.css'
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { useImageMap } from '@/composables/useImageMap'
import {
  apertureRingAtPoint,
  constrainApertureRadii,
  createApertureRadii,
  imagePointDistance,
  maximumRadiusAtImagePoint,
  resizeApertureRegion,
} from '@/utils/apertureRegion'
import CoordinateValue from '@/components/Global/CoordinateValue.vue'
import {
  coordinateInputToDegrees,
  raDegreesToSexagesimal,
  decDegreesToSexagesimal,
  raSexagesimalToDegrees,
  decSexagesimalToDegrees,
} from '@/utils/coordinates'

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
let catalogLayerGroup = null
let centroidOverlay = null
let centroidDrawStart = null
let wasMapDraggingEnabled = false
let activeApertureRing = null
let imageDimensions = ref({ width: 0, height: 0 })
const leafletDiv = ref(null)
const isHoveringLeaflet = ref(false)
const raDec = ref({ ra: 0, dec: 0 })
const isLeafletDrawToolActive = ref(false)
const alerts = useAlertsStore()
const analysisStore = useAnalysisStore()
const {
  addImageOverlay,
  createImageMap,
  fitImageOverlay,
  imagePointToRaDec,
  removeImageMap,
  setWcsSolution,
} = useImageMap()

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
  if (imageMap) {
    removeImageMap(imageMap)
  }

  imageMap = null
  imageBounds = null
  imageOverlay = null
  lineLayer = null
  catalogLayerGroup = null
  centroidOverlay = null
  centroidDrawStart = null
})

// When the catalog is updated we want to recreate the catalog layer
watch(() => props.catalog, () => createCatalogLayer())

watch(() => props.centroidRegion, (newRegion) => {
  syncCentroidOverlay(newRegion)
}, { deep: true })

watch(() => props.wcsSolution, (solution) => {
  if (solution) {
    setWcsSolution(solution)
  }
}, { immediate: true })

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

  const overlay = await addImageOverlay(imageMap, imgSrc)
  imageBounds = overlay.imageBounds
  imageDimensions.value = overlay.imageDimensions
  imageOverlay = overlay.imageOverlay
  fitImageOverlay(imageMap, imageBounds)

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

}

function createMap(){
  imageMap = createImageMap(leafletDiv.value)

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
    if (activeApertureRing) {
      resizeApertureRing(e.latlng)
    } else {
      handleCentroidDrag(e)
    }

    // If we don't have a WCS solution, we can't display coordinates
    if(!props.wcsSolution) return

    raDec.value = imagePointToRaDec(e.latlng, imageDimensions.value)
  })

  imageMap.on('mousedown', handleMapPointerStart)
  imageMap.on('mouseup', handleMapPointerEnd)
  imageMap.on('mouseout', handleMapPointerEnd)
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
    const div = document.createElement('div')
    div.append('Flux: ', `${source.flux} counts`)
    div.append(document.createElement('br'))
    div.append('RA: ', catalogCoordinateValue(source.ra, 'ra'))
    div.append(document.createElement('br'))
    div.append('Dec: ', catalogCoordinateValue(source.dec, 'dec'))
    div.append(document.createElement('br'))
    if (source.flux_fallback !== true) {
      div.append('Magnitude: ', Number(source.mag).toFixed(3))
      div.append(document.createElement('br'))
    }
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

function catalogCoordinateValue(value, axis) {
  let sexagesimal = false
  const span = document.createElement('span')
  span.className = 'coordinate-popup-value'

  function updateText() {
    const degrees = axis === 'ra'
      ? coordinateInputToDegrees(value, raSexagesimalToDegrees)
      : coordinateInputToDegrees(value, decSexagesimalToDegrees)
    span.textContent = sexagesimal
      ? axis === 'ra' ? raDegreesToSexagesimal(degrees) : decDegreesToSexagesimal(degrees)
      : `${degrees.toFixed(6)}°`
  }

  span.addEventListener('click', () => {
    sexagesimal = !sexagesimal
    updateText()
  })
  updateText()
  return span
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
  const apertureRadii = createApertureRadii(rawRadius, CENTROID_DEFAULTS, MIN_CENTROID_RADIUS)
  const maximumOuterRadius = maximumRadiusAtImagePoint(center, imageDimensions.value)
  const constrainedRadii = constrainApertureRadii(apertureRadii, maximumOuterRadius)

  return {
    x: center.lng,
    y: center.lat,
    ra: null,
    dec: null,
    ...constrainedRadii,
    width: imageDimensions.value.width,
    height: imageDimensions.value.height,
    ready: true,
  }
}

function handleCentroidStart(event) {
  if (!centroidToolActive.value || isLeafletDrawToolActive.value || !imageMap || !imageBounds) {
    return
  }

  if (props.centroidRegion && props.centroidRegion.r_back2 > maximumRadiusAtImagePoint(event.latlng, imageDimensions.value)) {
    return
  }

  // disables map while centroiding is active, then reenables map dragging after centroiding is done in handleCentroidEnd
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
    imagePointDistance(centroidDrawStart, event.latlng),
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

function handleMapPointerStart(event) {
  const ring = props.centroidRegion && !isLeafletDrawToolActive.value
    ? apertureRingAtPoint(props.centroidRegion, event.latlng, 8)
    : null

  if (ring) {
    activeApertureRing = ring
    wasMapDraggingEnabled = imageMap.dragging.enabled()
    if (wasMapDraggingEnabled) {
      imageMap.dragging.disable()
    }
    return
  }

  handleCentroidStart(event)
}

function handleMapPointerEnd() {
  if (activeApertureRing) {
    activeApertureRing = null
    if (wasMapDraggingEnabled) {
      imageMap.dragging.enable()
    }
    wasMapDraggingEnabled = false
    return
  }

  handleCentroidEnd()
}

function resizeApertureRing(point) {
  const resizedRegion = resizeApertureRegion(
    props.centroidRegion,
    activeApertureRing,
    point,
    imageDimensions.value,
  )
  syncCentroidOverlay(resizedRegion)
  emitCentroidRegionUpdated(resizedRegion)
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
        RA:
        <coordinate-value
          :value="raDec.ra"
          axis="ra"
        />,
        Dec:
        <coordinate-value
          :value="raDec.dec"
          axis="dec"
        />
      </v-chip>
    </v-fade-transition>
  </div>
</template>
