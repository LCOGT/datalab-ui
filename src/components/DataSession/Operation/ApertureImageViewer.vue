<script setup>
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import '@/assets/css/image-viewer.css'
import { imagePixelScaleArcsec } from '@/utils/wcs'
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

const props = defineProps({
  imageUrl: {
    type: String,
    default: '',
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
  },
  apertureRadii: {
    type: Object,
    default: null,
  },
  aperturePixelRadii: {
    type: Object,
    default: null,
  },
  apertureCenterCoordinate: {
    type: Object,
    default: null,
  },
  enableCentroidTool: {
    type: Boolean,
    default: true,
  },
  preserveApertureRadiiOnSelect: {
    type: Boolean,
    default: false,
  },
})

const centroidToolActive = defineModel('centroidToolActive', {
  type: Boolean,
  default: false,
})

const emit = defineEmits(['analysisAction', 'centroidRegionUpdated', 'coordinateValidationUpdated'])

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
let centroidOverlay = null
let centroidDrawStart = null
let wasMapDraggingEnabled = false
let activeApertureRing = null
let imageDimensions = ref({ width: 0, height: 0 })
const leafletDiv = ref(null)
const isHoveringLeaflet = ref(false)
const raDec = ref({ ra: 0, dec: 0 })
const {
  addImageOverlay,
  createImageMap,
  fitImageOverlay,
  imagePointToRaDec,
  raDecToImagePoint,
  removeImageMap,
  setWcsSolution,
} = useImageMap()

onMounted(() => {
  // Initialize the map and its event listeners before adding the image overlay
  createMap()
  addMapHandlers()

  if (props.imageUrl) {
    initImageOverlay(props.imageUrl)
  }
})

onUnmounted(() => {
  if (imageMap) {
    removeImageMap(imageMap)
  }

  imageMap = null
  imageBounds = null
  imageOverlay = null
  centroidOverlay = null
  centroidDrawStart = null
})

watch(() => props.centroidRegion, (newRegion) => {
  syncCentroidOverlay(newRegion)
}, { deep: true })

watch(() => props.apertureRadii, () => {
  validateApertureCenter()
  syncCentroidOverlay(props.centroidRegion)
}, { deep: true })

watch(() => props.aperturePixelRadii, () => {
  validateApertureCenter()
  syncCentroidOverlay(props.centroidRegion)
}, { deep: true })
watch(() => props.apertureCenterCoordinate, () => {
  validateApertureCenter()
  syncCentroidOverlay(props.centroidRegion)
}, { deep: true })

watch(() => props.wcsSolution, () => {
  if (props.wcsSolution) {
    setWcsSolution(props.wcsSolution)
  }
  validateApertureCenter()
  syncCentroidOverlay(props.centroidRegion)
}, { deep: true, immediate: true })

watch(centroidToolActive, (newValue) => {
  if (!newValue) {
    centroidDrawStart = null
  }
  syncCentroidToolControl()
}, { immediate: true })

// update url property of the ImageOverlay Layer or create it
watch(() => props.imageUrl, (newImageUrl) => {
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
  validateApertureCenter()

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
    drawPolyline: false,
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

function toggleCentroidTool() {
  if (!props.enableCentroidTool) return
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
  centroidToolContainer?.classList.toggle('d-none', !props.enableCentroidTool)
}

function emitCentroidRegionUpdated(region, reason) {
  emit('centroidRegionUpdated', region ? { ...region } : null, reason)
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
  const pixelRadii = props.preserveApertureRadiiOnSelect && props.aperturePixelRadii
    ? props.aperturePixelRadii
    : null
  const apertureRadii = pixelRadii
    ? {
      radius: pixelRadii.apertureRadius,
      r_back1: pixelRadii.annulusInnerRadius,
      r_back2: pixelRadii.annulusOuterRadius,
    }
    : createApertureRadii(rawRadius, CENTROID_DEFAULTS, MIN_CENTROID_RADIUS)
  const maximumOuterRadius = maximumRadiusAtImagePoint(center, imageDimensions.value)
  const constrainedRadii = constrainApertureRadii(apertureRadii, maximumOuterRadius)

  const coordinates = imageLatLngToRaDec(center)
  return {
    x: center.lng,
    y: center.lat,
    ra: coordinates.ra,
    dec: coordinates.dec,
    ...constrainedRadii,
    width: imageDimensions.value.width,
    height: imageDimensions.value.height,
    ready: true,
  }
}

function imageLatLngToRaDec(latlng) {
  if (!props.wcsSolution) return { ra: null, dec: null }
  return imagePointToRaDec(latlng, imageDimensions.value)
}

function handleCentroidStart(event) {
  if (!props.enableCentroidTool || !centroidToolActive.value || !imageMap || !imageBounds) {
    return
  }

  if (props.centroidRegion && apertureOuterRadius() > maximumRadiusAtImagePoint(event.latlng, imageDimensions.value)) {
    return
  }

  // disables map while centroiding is active, then reenables map dragging after centroiding is done in handleCentroidEnd
  wasMapDraggingEnabled = imageMap.dragging.enabled()
  if (wasMapDraggingEnabled) {
    imageMap.dragging.disable()
  }

  centroidDrawStart = event.latlng
  const region = buildCentroidRegion(event.latlng, MIN_CENTROID_RADIUS)
  syncCentroidOverlay(region, false)
  emitCentroidRegionUpdated(region)
}

function handleCentroidDrag(event) {
  if (!centroidToolActive.value || !centroidDrawStart) {
    return
  }

  const region = buildCentroidRegion(
    centroidDrawStart,
    imagePointDistance(centroidDrawStart, event.latlng),
  )

  syncCentroidOverlay(region, false)
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
  const region = apertureDisplayRegion(props.centroidRegion)
  const ring = region && (props.apertureRadii || props.aperturePixelRadii)
    ? apertureRingAtPoint(region, event.latlng, 8)
    : null
  if (ring) {
    activeApertureRing = ring
    wasMapDraggingEnabled = imageMap.dragging.enabled()
    if (wasMapDraggingEnabled) imageMap.dragging.disable()
    return
  }
  handleCentroidStart(event)
}

function handleMapPointerEnd() {
  if (activeApertureRing) {
    activeApertureRing = null
    if (wasMapDraggingEnabled) imageMap.dragging.enable()
    wasMapDraggingEnabled = false
    return
  }
  handleCentroidEnd()
}

function resizeApertureRing(point) {
  const region = apertureDisplayRegion(props.centroidRegion)
  const resized = resizeApertureRegion(region, activeApertureRing, point, imageDimensions.value)

  syncCentroidOverlay(resized, false)
  emitCentroidRegionUpdated(resized, 'resize')
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

function syncCentroidOverlay(region, useInputRadii = true) {
  if (!imageMap) {
    return
  }

  const displayRegion = useInputRadii ? apertureDisplayRegion(region) : region
  if (!displayRegion) {
    if (centroidOverlay && imageMap.hasLayer(centroidOverlay)) {
      imageMap.removeLayer(centroidOverlay)
    }
    centroidOverlay = null
    return
  }

  const center = [displayRegion.y, displayRegion.x]
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
      radius: displayRegion.radius,
      color: 'var(--cancel)',
      fill: false,
      weight: 2,
      pmIgnore: true,
    }),
    L.circle(center, {
      radius: displayRegion.r_back1,
      color: 'var(--warning)',
      fill: false,
      dashArray: '6 4',
      weight: 2,
      pmIgnore: true,
    }),
    L.circle(center, {
      radius: displayRegion.r_back2,
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

function apertureDisplayRegion(region) {
  const baseRegion = apertureCenterRegion() || region
  if (!baseRegion || !props.wcsSolution || (!props.apertureRadii && !props.aperturePixelRadii)) return baseRegion

  const scale = imagePixelScaleArcsec(props.wcsSolution, imageDimensions.value.width, imageDimensions.value.height)
  const pixelRadii = props.aperturePixelRadii || {
    apertureRadius: props.apertureRadii.apertureRadius / scale,
    annulusInnerRadius: props.apertureRadii.annulusInnerRadius / scale,
    annulusOuterRadius: props.apertureRadii.annulusOuterRadius / scale,
  }
  const maximumOuterRadius = maximumRadiusAtImagePoint(
    { lng: baseRegion.x, lat: baseRegion.y },
    imageDimensions.value,
  )
  const constrainedRadii = constrainApertureRadii({
    radius: pixelRadii.apertureRadius,
    r_back1: pixelRadii.annulusInnerRadius,
    r_back2: pixelRadii.annulusOuterRadius,
  }, maximumOuterRadius)
  return {
    ...baseRegion,
    ...constrainedRadii,
  }
}

function apertureCenterRegion() {
  const region = coordinateRegion()
  if (!region || !coordinateIsInsideImage(region)) return null
  return region
}

function coordinateRegion() {
  if (!props.apertureCenterCoordinate || !props.wcsSolution || !imageDimensions.value.width) return null
  const imagePoint = raDecToImagePoint(props.apertureCenterCoordinate, imageDimensions.value)
  return {
    x: imagePoint.x,
    y: imagePoint.y,
    ra: props.apertureCenterCoordinate.ra,
    dec: props.apertureCenterCoordinate.dec,
    width: imageDimensions.value.width,
    height: imageDimensions.value.height,
    ready: true,
  }
}

function coordinateIsInsideImage(region) {
  return region.x >= 0 && region.y >= 0 &&
    region.x <= imageDimensions.value.width && region.y <= imageDimensions.value.height
}

function apertureOuterRadius() {
  if (props.aperturePixelRadii) return props.aperturePixelRadii.annulusOuterRadius
  if (!props.apertureRadii || !props.wcsSolution) return 0
  const scale = imagePixelScaleArcsec(props.wcsSolution, imageDimensions.value.width, imageDimensions.value.height)
  return props.apertureRadii.annulusOuterRadius / scale
}

function validateApertureCenter() {
  if (!props.apertureCenterCoordinate) {
    emit('coordinateValidationUpdated', null)
    return
  }

  const region = coordinateRegion()
  if (!region) {
    emit('coordinateValidationUpdated', null)
    return
  }
  if (!coordinateIsInsideImage(region)) {
    emit('coordinateValidationUpdated', { error: 'invalid RA and Dec' })
    return
  }

  const center = { lng: region.x, lat: region.y }
  if (apertureOuterRadius() > maximumRadiusAtImagePoint(center, imageDimensions.value)) {
    emit('coordinateValidationUpdated', { error: 'Please adjust your aperture radii', region })
    return
  }

  emit('coordinateValidationUpdated', { region })
}

</script>
<template>
  <div
    ref="leafletDiv"
    class="position-relative aperture-image-viewer"
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
<style scoped>
.aperture-image-viewer {
  width: 100%;
  height: 520px;
  max-height: 62vh;
  min-height: 420px;
}
</style>
