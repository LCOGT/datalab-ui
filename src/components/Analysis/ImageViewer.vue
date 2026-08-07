<script setup>
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { loadImage, scalePoint } from '@/utils/common'
import WCS from '@/utils/wcs'
import { imagePixelScaleArcsec } from '@/utils/wcs'

const props = defineProps({
  imageUrl: {
    type: String,
    default: '',
  },
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
  },
  apertureRadii: {
    type: Object,
    required: false,
    default: null,
  },
  apertureCenterCoordinate: {
    type: Object,
    required: false,
    default: null,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  enableLineProfile: {
    type: Boolean,
    default: true,
  },
  enableCatalog: {
    type: Boolean,
    default: true,
  },
  enableCentroidTool: {
    type: Boolean,
    default: true,
  },
  reloadOnImageUrlChange: {
    type: Boolean,
    default: true,
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
const MIN_FIT_SIZE = 100
const MIN_RADIUS_GAP = 1
// when the image is first loaded, its size is really small, so we need to retry fitting the map to the image a few times until it has a stable size
// 12 is a bit arbitrary but it roughly takes 200ms for the image to load and be displayed at its full size, so this should be enough retries
const MAX_IMAGE_FIT_RETRIES = 12
const APERTURE_RADIUS_KEYS = ['apertureRadius', 'annulusInnerRadius', 'annulusOuterRadius']
const APERTURE_REGION_RADIUS_KEYS = ['radius', 'r_back1', 'r_back2']
const APERTURE_RING_STYLES = {
  radius: { color: 'var(--cancel)' },
  r_back1: { color: 'var(--warning)', dashArray: '6 4' },
  r_back2: { color: 'var(--warning)', dashArray: '3 4' },
}
//  in pixels
const RADIUS_HANDLE_THRESHOLD = {
  mouse: 8,
  touch: 20,
}

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
let resizeObserver = null
let imageFitFrame = null
let fitAttempts = 0
let userChangedView = false
let programmaticViewChange = false
let activeRadiusHandle = null
let imageDimensions = ref({ width: 0, height: 0 })
const leafletDiv = ref(null)
const isHoveringLeaflet = ref(false)
const raDec = ref(null)
const isLeafletDrawToolActive = ref(false)
const alerts = useAlertsStore()
const analysisStore = useAnalysisStore()
let viewerInstanceId = 0
const activeImageUrl = computed(() => props.imageUrl || analysisStore.imageUrl)

onMounted(() => {
  // Initialize the map and its event listeners before adding the image overlay
  createMap()
  addMapHandlers()
  observeMapSize()

  if (activeImageUrl.value) {
    initImageOverlay(activeImageUrl.value)
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
  resizeObserver?.disconnect()
  if (imageFitFrame) {
    cancelAnimationFrame(imageFitFrame)
  }

  imageMap = null
  imageBounds = null
  imageOverlay = null
  lineLayer = null
  wcs = null
  catalogLayerGroup = null
  centroidOverlay = null
  centroidDrawStart = null
  resizeObserver = null
  imageFitFrame = null
  fitAttempts = 0
  userChangedView = false
  programmaticViewChange = false
  activeRadiusHandle = null
})

// When the catalog is updated we want to recreate the catalog layer
watch(() => props.catalog, () => createCatalogLayer())

watch(() => props.centroidRegion, (newRegion) => {
  syncCentroidOverlay(newRegion)
}, { deep: true })

watch(() => props.apertureRadii, () => {
  syncCentroidOverlay(props.centroidRegion)
}, { deep: true })

watch(() => props.apertureCenterCoordinate, () => {
  syncCentroidOverlay(props.centroidRegion)
}, { deep: true })

watch(() => props.wcsSolution, () => {
  wcs = null
  syncCentroidOverlay(props.centroidRegion)
})

watch(centroidToolActive, (newValue) => {
  if (!newValue) {
    centroidDrawStart = null
  }
  syncCentroidToolControl()
}, { immediate: true })

// update url property of the ImageOverlay Layer or create it
watch(activeImageUrl, (newImageUrl) => {
  if (!newImageUrl || !imageMap) return

  if (imageOverlay && !props.reloadOnImageUrlChange) {
    imageOverlay.setUrl(newImageUrl)
    return
  }

  userChangedView = false
  initImageOverlay(newImageUrl)
})

// Creates image overlay and sets bounds
async function initImageOverlay(imgSrc) {
  if (!imgSrc || !imageMap) return

  const instanceId = viewerInstanceId
  const img = await loadImage(imgSrc)

  if (instanceId !== viewerInstanceId || !imageMap) return

  fitAttempts = 0
  imageDimensions.value = { width: img.width, height: img.height }

  // Fetch catalog only if empty
  if (props.enableCatalog && !props.catalog?.length){
    const catalogInput = {
      width: imageDimensions.value.width,
      height: imageDimensions.value.height,
    }
    emit('analysisAction', 'source-catalog', catalogInput)
  }

  // Fetch WCS data for pix to world transformation
  emit('analysisAction', 'wcs')

  imageBounds = [[0, 0], [imageDimensions.value.height, imageDimensions.value.width]]
  if (imageOverlay) {
    imageOverlay.setUrl(imgSrc)
    imageOverlay.setBounds(imageBounds)
  } else {
    imageOverlay = L.imageOverlay(imgSrc, imageBounds).addTo(imageMap)
  }

  nextTick(() => {
    refitMapToImage({ resetZoom: true })
    syncCentroidOverlay(props.centroidRegion)
  })
}

function observeMapSize() {
  resizeObserver = new ResizeObserver(() => refitMapToImage({ resetZoom: !userChangedView }))
  resizeObserver.observe(leafletDiv.value)
}

function refitMapToImage({ resetZoom = true } = {}) {
  if (imageFitFrame) {
    cancelAnimationFrame(imageFitFrame)
  }

  imageFitFrame = requestAnimationFrame(() => {
    imageFitFrame = null
    if (!imageMap || !imageBounds) return

    imageMap.invalidateSize()
    if (!resetZoom || userChangedView) return

    if (!imageViewerHasStableSize()) {
      fitAttempts += 1
      if (fitAttempts < MAX_IMAGE_FIT_RETRIES) {
        refitMapToImage({ resetZoom: true })
      }
      return
    }

    fitAttempts = 0
    programmaticViewChange = true
    imageMap.fitBounds(imageBounds, { animate: false })
    imageMap.setMaxBounds(imageBounds)
    imageMap.setMinZoom(imageMap.getZoom())
    requestAnimationFrame(() => {
      programmaticViewChange = false
    })
  })
}

function imageViewerHasStableSize() {
  const { width, height } = leafletDiv.value.getBoundingClientRect()
  return width > MIN_FIT_SIZE && height > MIN_FIT_SIZE
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
    drawPolyline: props.enableLineProfile,
    editMode: false,
    dragMode: false,
    cutPolygon: false,
    rotateMode: false,
    removalMode: false
  })
}

function addMapHandlers() {
  const mapContainer = imageMap.getContainer()

  imageMap.on('zoomstart dragstart', () => {
    if (!programmaticViewChange) {
      userChangedView = true
    }
  })

  // Remove last drawn line when starting new one
  imageMap.on('pm:drawstart', ({ workingLayer }) => {
    if (!props.enableLineProfile) return
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
    if (!props.enableLineProfile) return
    isLeafletDrawToolActive.value = false
    lineLayer = e.layer
    requestLineProfile(lineLayer.getLatLngs())
  })

  imageMap.on('pm:drawend', () => {
    isLeafletDrawToolActive.value = false
  })

  // Handler for displaying ra, dec coordinates when hovering over the image
  imageMap.on('mousemove', (e) => {
    if (activeRadiusHandle) {
      handleApertureRadiusDrag(e.latlng)
      updateCursorRaDec(e.latlng)
      imageMap.getContainer().style.cursor = 'grabbing'
      return
    }

    handleCentroidDrag(e)
    updateCursorRaDec(e.latlng)
    updateRadiusResizeCursor(e.latlng, 'mouse')
  })

  imageMap.on('mousedown', (e) => {
    if (handleApertureRadiusStart(e.latlng, 'mouse')) {
      return
    }

    handleCentroidStart(e)
  })
  imageMap.on('mouseup', (e) => {
    handleApertureRadiusEnd(e.latlng)
    handleCentroidEnd()
  })
  imageMap.on('mouseout', () => {
    handleApertureRadiusEnd()
    handleCentroidEnd()
    raDec.value = null
    imageMap.getContainer().style.cursor = ''
  })
  mapContainer.addEventListener('touchstart', handleMapTouchStart, { passive: false })
  mapContainer.addEventListener('touchmove', handleMapTouchMove, { passive: false })
  mapContainer.addEventListener('touchend', handleMapTouchEnd, { passive: false })
  mapContainer.addEventListener('touchcancel', handleMapTouchEnd, { passive: false })
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
  if (!imageMap || !props.enableCatalog || !Array.isArray(props.catalog) || !props.catalog.length) {
    return
  }

  // Function to create a marker for a source
  function createSourceMarker(source){
    // Marker popup text
    const div = document.createElement('div')
    div.innerHTML = `
      <b>Flux:</b> ${source.flux ?? 'N/A'} counts<br>
      <b>RA:</b> ${source.ra ?? 'N/A'} degrees<br>
      <b>Dec:</b> ${source.dec ?? 'N/A'} degrees<br>
      ${source.flux_fallback !== true ? `<b>Magnitude:</b> ${Number(source.mag).toFixed(3) ?? 'N/A'}<br>` : ''}
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

  centroidToolButton.closest('.button-container')?.classList.toggle('d-none', !props.enableCentroidTool)

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
  const coordinate = props.wcsSolution ? imageLatLngToRaDec(center) : { ra: null, dec: null }
  const region = {
    x: center.lng,
    y: center.lat,
    ...coordinate,
    width: imageDimensions.value.width,
    height: imageDimensions.value.height,
    ready: true,
  }
  const maxRadius = maxImageRadius(region) / (CENTROID_DEFAULTS.r_back2 / CENTROID_DEFAULTS.radius)
  const radius = Math.min(Math.max(rawRadius, MIN_CENTROID_RADIUS), maxRadius)

  return {
    ...region,
    radius,
    r_back1: radius * (CENTROID_DEFAULTS.r_back1 / CENTROID_DEFAULTS.radius),
    r_back2: radius * (CENTROID_DEFAULTS.r_back2 / CENTROID_DEFAULTS.radius),
  }
}

function getWcs() {
  if (!wcs) {
    const { crval, crpix, cd1, cd2, fits_dimensions } = props.wcsSolution
    wcs = new WCS(crval[0], crval[1], crpix[0], crpix[1], cd1[0], cd1[1], cd2[0], cd2[1], fits_dimensions)
  }

  return wcs
}

function imageLatLngToFitsPixel(latlng) {
  const activeWcs = getWcs()
  return scalePoint(
    imageDimensions.value.width,
    imageDimensions.value.height,
    activeWcs.fits_dimensions[0],
    activeWcs.fits_dimensions[1],
    latlng.lng,
    latlng.lat,
  )
}

function imageLatLngToRaDec(latlng) {
  const pixel = imageLatLngToFitsPixel(latlng)
  return getWcs().pixelToRaDec(pixel.x, pixel.y)
}

function updateCursorRaDec(latlng) {
  raDec.value = props.wcsSolution && latLngInsideImage(latlng) ? imageLatLngToRaDec(latlng) : null
}

function fitsPixelToImageLatLng(pixel) {
  const activeWcs = getWcs()
  const point = scalePoint(
    activeWcs.fits_dimensions[0],
    activeWcs.fits_dimensions[1],
    imageDimensions.value.width,
    imageDimensions.value.height,
    pixel.x,
    pixel.y,
  )

  return L.latLng(point.y, point.x)
}

function raDecToImageLatLng(coordinate) {
  return fitsPixelToImageLatLng(getWcs().raDecToPixel(coordinate.ra, coordinate.dec))
}

function latLngInsideImage(latlng) {
  return latlng.lng >= 0 &&
    latlng.lat >= 0 &&
    latlng.lng <= imageDimensions.value.width &&
    latlng.lat <= imageDimensions.value.height
}

function handleViewerMouseLeave() {
  isHoveringLeaflet.value = false
  raDec.value = null
}

function handleCentroidStart(event) {
  if (!centroidToolActive.value || isLeafletDrawToolActive.value || !imageMap || !imageBounds) {
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
  if (!centroidToolActive.value || isLeafletDrawToolActive.value || !centroidDrawStart) {
    return
  }

  const region = buildCentroidRegion(
    centroidDrawStart,
    centroidDistance(centroidDrawStart, event.latlng),
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

function handleCentroidTouchStart(event) {
  if (!centroidToolActive.value) return

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

function handleMapTouchStart(event) {
  const latlng = latLngFromTouchEvent(event)
  if (!latlng) {
    return
  }

  if (handleApertureRadiusStart(latlng, 'touch')) {
    event.preventDefault()
    return
  }

  handleCentroidTouchStart(event)
}

function handleMapTouchMove(event) {
  const latlng = latLngFromTouchEvent(event)
  if (!latlng) {
    return
  }

  if (activeRadiusHandle) {
    event.preventDefault()
    handleApertureRadiusDrag(latlng)
    return
  }

  handleCentroidTouchMove(event)
}

function handleMapTouchEnd(event) {
  if (activeRadiusHandle) {
    event.preventDefault()
    handleApertureRadiusEnd()
    return
  }

  handleCentroidTouchEnd(event)
}

function handleApertureRadiusStart(latlng, pointerType) {
  const hit = findApertureRadiusHandle(latlng, pointerType)
  if (!hit) {
    return false
  }

  activeRadiusHandle = hit.key
  centroidDrawStart = null
  wasMapDraggingEnabled = imageMap.dragging.enabled()
  if (wasMapDraggingEnabled) {
    imageMap.dragging.disable()
  }
  imageMap.getContainer().style.cursor = 'grabbing'
  return true
}

function handleApertureRadiusDrag(latlng) {
  const region = buildDisplayApertureRegion(props.centroidRegion)
  const center = L.latLng(region.y, region.x)
  const resizedRegion = resizeApertureRegion(region, activeRadiusHandle, centroidDistance(center, latlng))

  syncCentroidOverlay(resizedRegion, false)
  emitCentroidRegionUpdated(resizedRegion)
}

function handleApertureRadiusEnd(latlng) {
  if (!activeRadiusHandle) {
    return
  }

  activeRadiusHandle = null
  if (wasMapDraggingEnabled) {
    imageMap.dragging.enable()
  }
  wasMapDraggingEnabled = false

  if (latlng) {
    updateRadiusResizeCursor(latlng, 'mouse')
    return
  }

  imageMap.getContainer().style.cursor = ''
}

function resizeApertureRegion(region, key, radius) {
  const resizedRegion = { ...region }
  const maxRadius = maxImageRadius(region)

  if (key === 'radius') {
    resizedRegion.radius = Math.max(MIN_CENTROID_RADIUS, Math.min(radius, resizedRegion.r_back1 - MIN_RADIUS_GAP))
  } else if (key === 'r_back1') {
    resizedRegion.r_back1 = Math.max(resizedRegion.radius + MIN_RADIUS_GAP, Math.min(radius, resizedRegion.r_back2 - MIN_RADIUS_GAP))
  } else {
    resizedRegion.r_back2 = Math.max(resizedRegion.r_back1 + MIN_RADIUS_GAP, Math.min(radius, maxRadius))
  }

  return resizedRegion
}

function maxImageRadius(region) {
  return Math.min(
    region.x,
    region.y,
    region.width - region.x,
    region.height - region.y,
  )
}

function findApertureRadiusHandle(latlng, pointerType) {
  const region = buildDisplayApertureRegion(props.centroidRegion)
  if (!region) {
    return null
  }

  const center = L.latLng(region.y, region.x)
  const cursorRadius = imageMap.latLngToContainerPoint(center).distanceTo(imageMap.latLngToContainerPoint(latlng))
  const threshold = RADIUS_HANDLE_THRESHOLD[pointerType]
  let closestHandle = null

  for (const key of APERTURE_REGION_RADIUS_KEYS) {
    const distance = Math.abs(cursorRadius - screenRadius(region, key))
    if (distance <= threshold && (!closestHandle || distance < closestHandle.distance)) {
      closestHandle = { key, distance }
    }
  }

  return closestHandle
}

function screenRadius(region, key) {
  const center = L.latLng(region.y, region.x)
  const edge = L.latLng(region.y, region.x + region[key])

  return imageMap.latLngToContainerPoint(center).distanceTo(imageMap.latLngToContainerPoint(edge))
}

function updateRadiusResizeCursor(latlng, pointerType) {
  const hit = findApertureRadiusHandle(latlng, pointerType)
  let cursor = ''

  if (activeRadiusHandle || hit) {
    cursor = 'grabbing'
  }

  imageMap.getContainer().style.cursor = cursor
}

function syncCentroidOverlay(region, useApertureInputs = true) {
  if (!imageMap) {
    return
  }

  const displayRegion = useApertureInputs ? buildDisplayApertureRegion(region) : region

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
      interactive: false,
    })
  ]

  for (const key of APERTURE_REGION_RADIUS_KEYS) {
    if (displayRegion[key] != null) {
      layers.push(createApertureRing(center, displayRegion[key], APERTURE_RING_STYLES[key]))
    }
  }

  if (centroidOverlay) {
    centroidOverlay.clearLayers()
    layers.forEach((layer) => centroidOverlay.addLayer(layer))
    return
  }

  centroidOverlay = new L.LayerGroup(layers)
  centroidOverlay.addTo(imageMap)
}

function createApertureRing(center, radius, style) {
  return L.circle(center, {
    radius,
    fill: false,
    weight: 2,
    pmIgnore: true,
    interactive: false,
    ...style,
  })
}

function buildDisplayApertureRegion(region) {
  const coordinateRegion = apertureCenterRegion()
  const baseRegion = coordinateRegion || region

  if (!baseRegion || !props.wcsSolution || !hasApertureRadii()) {
    return baseRegion
  }

  const pixelScale = imagePixelScaleArcsec(props.wcsSolution, imageDimensions.value.width, imageDimensions.value.height)

  return {
    ...baseRegion,
    radius: props.apertureRadii.apertureRadius / pixelScale,
    r_back1: props.apertureRadii.annulusInnerRadius / pixelScale,
    r_back2: props.apertureRadii.annulusOuterRadius / pixelScale,
  }
}

function hasApertureRadii() {
  return props.apertureRadii && APERTURE_RADIUS_KEYS.every((key) => props.apertureRadii[key] != null)
}

function apertureCenterRegion() {
  if (!props.apertureCenterCoordinate || !props.wcsSolution || !imageDimensions.value.width) {
    return null
  }

  const center = raDecToImageLatLng(props.apertureCenterCoordinate)
  if (!latLngInsideImage(center)) {
    return null
  }

  return {
    x: center.lng,
    y: center.lat,
    ra: props.apertureCenterCoordinate.ra,
    dec: props.apertureCenterCoordinate.dec,
    width: imageDimensions.value.width,
    height: imageDimensions.value.height,
    ready: true,
  }
}

</script>
<template>
  <div
    ref="leafletDiv"
    class="position-relative image-viewer"
    :class="{ 'image-viewer--compact': props.compact }"
    :style="{ width: props.compact ? '100%' : imageDimensions.width + 'px' }"
    @mouseenter="isHoveringLeaflet = true"
    @mouseleave="handleViewerMouseLeave"
  >
    <v-fade-transition>
      <v-chip
        v-if="isHoveringLeaflet && raDec"
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

.image-viewer {
  height: 100%;
}

.image-viewer--compact {
  height: 520px;
  max-height: 62vh;
  min-height: 420px;
}

</style>
