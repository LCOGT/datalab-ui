<script setup>
import { computed, ref, watch } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useConfigurationStore } from '@/stores/configuration'
import { useThumbnailsStore } from '@/stores/thumbnails'
import ApertureImageViewer from '@/components/DataSession/Operation/ApertureImageViewer.vue'
import SourceInputWidget from '@/components/DataSession/Operation/SourceInputWidget.vue'
import HistogramSlider from '@/components/Global/Scaling/HistogramSlider.vue'
import { useImageScaling } from '@/components/Global/Scaling/useImageScaling'
import { fetchApiCall } from '@/utils/api'
import { ensureLargeCachedUrl } from '@/utils/common'
import { coordinateInputToDegrees, raSexagesimalToDegrees, decSexagesimalToDegrees } from '@/utils/coordinates'
import { dateToMjd } from '@/utils/formatDate'
import { imagePixelScaleArcsec } from '@/utils/wcs'

const APERTURE_RADIUS_KEYS = {
  apertureRadius: 'radius',
  annulusInnerRadius: 'r_back1',
  annulusOuterRadius: 'r_back2',
}

const source = defineModel({
  type: Object,
  required: true,
})

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  image: {
    type: Object,
    default: null,
  },
  // the backend takes aperture radii in arcseconds
  apertureRadii: {
    type: Object,
    required: true,
  },
  // we need aperture radii in pixels to draw and resize the radii rings
  // this is important for moving target aperture photomtery to keep the radii consistent
  // between first and last images if the images have different pixel scales
  aperturePixelRadii: {
    type: Object,
    default: null,
  },
  centroidRegion: {
    type: Object,
    default: null,
  },
  nameLookup: {
    type: Boolean,
    default: false,
  },
  coordinateReadOnly: {
    type: Boolean,
    default: false,
  },
  includeMjd: {
    type: Boolean,
    default: false,
  },
  preserveApertureRadii: {
    type: Boolean,
    default: false,
  },
  syncPixelRadii: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['updateApertureRadii', 'updateAperturePixelRadii', 'updateCentroidRegion'])
const analysisStore = useAnalysisStore()
const configStore = useConfigurationStore()
const thumbnailsStore = useThumbnailsStore()
const coordinateError = ref('')
const imageUrl = ref('')
const wcsSolution = ref(null)
const localCentroidRegion = ref(props.centroidRegion)
const centroidResult = ref(null)
const centroidToolActive = ref(false)
const usePlaneBackground = ref(false)

const {
  zmin,
  zmax,
  scalerReady,
  scaledImageUrl,
  imageScaleReady,
  histogram,
  bins,
  maxPixelValue,
  loadScaledImage,
  resetImageScaling,
  updateScaling,
} = useImageScaling()

const displayImageUrl = computed(() => {
  return scaledImageUrl.value || imageUrl.value
})
const apertureCenterCoordinate = computed(() => {
  if (source.value.ra == null || source.value.ra === '' || source.value.dec == null || source.value.dec === '') {
    return null
  }

  const ra = coordinateInputToDegrees(source.value.ra, raSexagesimalToDegrees)
  const dec = coordinateInputToDegrees(source.value.dec, decSexagesimalToDegrees)
  return { ra, dec }
})

watch(() => props.image, loadImage, { immediate: true })
watch(() => analysisStore.headerData, updateHeaderSource, { deep: true, immediate: true })

watch(() => props.centroidRegion, (region) => {
  localCentroidRegion.value = region
}, { deep: true })

watch(() => props.apertureRadii, syncCentroidRegionRadii, { deep: true })
watch(() => props.aperturePixelRadii, syncCentroidRegionRadii, { deep: true })

async function loadImage(image) {
  if (!image) {
    imageUrl.value = ''
    wcsSolution.value = null
    resetImageScaling()
    return
  }

  if (props.includeMjd) {
    source.value = { ...source.value, mjd: dateToMjd(image.observation_date) }
  }

  imageUrl.value = await ensureLargeCachedUrl(image, thumbnailsStore.cacheImage, configStore.archiveType)
  wcsSolution.value = null
  localCentroidRegion.value = props.centroidRegion
  centroidResult.value = null

  if (props.coordinateReadOnly) {
    if (analysisStore.image?.basename !== image.basename) {
      analysisStore.headerData = null
    }
    analysisStore.image = image
    analysisStore.loadHeaderData()
  }

  await loadScaledImage(image, imageUrl.value)
}

function updateHeaderSource(headerData) {
  if (props.coordinateReadOnly && headerData) {
    source.value = {
      ...source.value,
      ra: headerData['CAT-RA'],
      dec: headerData['CAT-DEC'],
    }
  }
}

function requestAnalysis(action, input = {}) {
  fetchApiCall({
    url: configStore.datalabApiBaseUrl + 'analysis/' + action + '/',
    method: 'POST',
    body: {
      basename: props.image.basename,
      source: props.image.source,
      ...input,
    },
    successCallback: response => handleAnalysisOutput(response, action),
  })
}

function handleAnalysisOutput(response, action) {
  if (action === 'wcs') {
    wcsSolution.value = response
    syncCentroidRegionRadii()
    syncPixelRadiiFromInputs(props.apertureRadii)
    return
  }

  centroidResult.value = response
  if (response.success) {
    source.value = { ...source.value, ra: response.ra, dec: response.dec }
    updateCentroidRegion({
      ...localCentroidRegion.value,
      x: response.x,
      y: response.y,
      ra: response.ra,
      dec: response.dec,
    })
  }
}

function updateCentroidRegion(region, reason) {
  localCentroidRegion.value = region
  emit('updateCentroidRegion', region)
  centroidResult.value = null

  if (!props.coordinateReadOnly && region.ra != null && region.dec != null) {
    source.value = { ...source.value, ra: region.ra, dec: region.dec }
  }

  if (props.preserveApertureRadii) {
    if (reason === 'resize') {
      emit('updateAperturePixelRadii', pixelRadiiFromRegion(region))
      updateApertureInputs(region)
    } else if (!props.aperturePixelRadii) {
      emit('updateAperturePixelRadii', pixelRadiiFromRegion(region))
    }
  } else {
    updateApertureInputs(region)
  }
}

function updateCoordinateValidation(validation) {
  coordinateError.value = validation?.error || ''
  if (validation?.region) {
    localCentroidRegion.value = validation.region
    emit('updateCentroidRegion', validation.region)
  }
}

function requestCentroid() {
  const region = localCentroidRegion.value
  requestAnalysis('centroiding', {
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    radius: region.radius,
    r_back1: region.r_back1,
    r_back2: region.r_back2,
    find_centroid: true,
    remove_background_stars: true,
    use_plane_background: usePlaneBackground.value,
  })
}

function updateApertureInputs(region) {
  if (!wcsSolution.value) return

  const scale = imagePixelScaleArcsec(wcsSolution.value, region.width, region.height)
  const radii = {}
  Object.entries(APERTURE_RADIUS_KEYS).forEach(([inputKey, regionKey]) => {
    radii[inputKey] = Math.round(region[regionKey] * scale * 100) / 100
  })
  emit('updateApertureRadii', radii)
}

function updateApertureRadius(radiusKey, value) {
  const apertureRadii = {
    ...props.apertureRadii,
    [radiusKey]: value === '' ? '' : Number(value),
  }

  emit('updateApertureRadii', apertureRadii)
  syncPixelRadiiFromInputs(apertureRadii)
}

function pixelRadiiFromRegion(region) {
  const radii = {}
  Object.entries(APERTURE_RADIUS_KEYS).forEach(([inputKey, regionKey]) => {
    radii[inputKey] = region[regionKey]
  })
  return radii
}

function syncCentroidRegionRadii() {
  const region = localCentroidRegion.value
  if (!region || !wcsSolution.value) return

  const scale = imagePixelScaleArcsec(wcsSolution.value, region.width, region.height)
  const pixelRadii = props.aperturePixelRadii || Object.fromEntries(
    Object.keys(APERTURE_RADIUS_KEYS).map(key => [key, props.apertureRadii[key] / scale])
  )
  localCentroidRegion.value = {
    ...region,
    radius: pixelRadii.apertureRadius,
    r_back1: pixelRadii.annulusInnerRadius,
    r_back2: pixelRadii.annulusOuterRadius,
  }
  emit('updateCentroidRegion', localCentroidRegion.value)
}

function syncPixelRadiiFromInputs(apertureRadii) {
  if (!props.syncPixelRadii || !localCentroidRegion.value || !wcsSolution.value) return

  const region = localCentroidRegion.value
  const scale = imagePixelScaleArcsec(wcsSolution.value, region.width, region.height)
  emit('updateAperturePixelRadii', Object.fromEntries(
    Object.keys(APERTURE_RADIUS_KEYS).map(key => [key, apertureRadii[key] / scale])
  ))
}
</script>

<template>
  <div class="aperture-source-editor">
    <h3 class="source-title">
      {{ props.title }}
    </h3>
    <source-input-widget
      v-model="source"
      :name-lookup="props.nameLookup"
      :coordinate-read-only="props.coordinateReadOnly"
    />
    <v-alert
      v-if="coordinateError"
      class="coordinate-error"
      density="compact"
      type="warning"
      :text="coordinateError"
    />
    <v-row v-if="props.image">
      <v-col
        cols="12"
        md="8"
      >
        <aperture-image-viewer
          v-if="displayImageUrl"
          :key="props.image.basename"
          v-model:centroid-tool-active="centroidToolActive"
          :image-url="displayImageUrl"
          :wcs-solution="wcsSolution"
          :enable-centroid-tool="!props.coordinateReadOnly"
          :centroid-region="localCentroidRegion"
          :aperture-radii="props.apertureRadii"
          :aperture-pixel-radii="props.aperturePixelRadii"
          :aperture-center-coordinate="apertureCenterCoordinate"
          :preserve-aperture-radii-on-select="props.preserveApertureRadii"
          @analysis-action="requestAnalysis"
          @centroid-region-updated="updateCentroidRegion"
          @coordinate-validation-updated="updateCoordinateValidation"
        />
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-text-field
          :model-value="props.apertureRadii.apertureRadius"
          label="Aperture radius"
          type="number"
          step="0.01"
          @update:model-value="updateApertureRadius('apertureRadius', $event)"
        />
        <v-text-field
          :model-value="props.apertureRadii.annulusInnerRadius"
          label="Annulus inner radius"
          type="number"
          step="0.01"
          @update:model-value="updateApertureRadius('annulusInnerRadius', $event)"
        />
        <v-text-field
          :model-value="props.apertureRadii.annulusOuterRadius"
          label="Annulus outer radius"
          type="number"
          step="0.01"
          @update:model-value="updateApertureRadius('annulusOuterRadius', $event)"
        />
        <v-sheet class="source-side-panel">
          <b>Centroiding</b>
          <v-checkbox
            v-if="!props.coordinateReadOnly"
            v-model="usePlaneBackground"
            label="Plane background removal"
            hide-details
          />
          <v-btn
            v-if="!props.coordinateReadOnly"
            class="mt-3"
            color="var(--primary-interactive)"
            :disabled="!localCentroidRegion?.ready"
            @click="requestCentroid"
          >
            Get Centroid
          </v-btn>
          <div
            v-if="centroidResult"
            class="centroid-meta mt-3"
          >
            {{ centroidResult.success ? 'Centroid updated' : centroidResult.error || centroidResult.message }}
          </div>
        </v-sheet>
        <v-sheet
          v-if="imageScaleReady && scalerReady"
          class="source-side-panel"
        >
          <histogram-slider
            :histogram="histogram"
            :bins="bins"
            :max-value="maxPixelValue"
            :z-min="Number(zmin)"
            :z-max="Number(zmax)"
            :color="{ r: 0, g: 173, b: 239 }"
            @update-scaling="updateScaling"
          />
        </v-sheet>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.aperture-source-editor {
  position: relative;
  width: 100%;
}

.source-title {
  color: var(--text);
  font-weight: 600;
  margin: 0.5rem 0;
}

.source-side-panel {
  background-color: var(--card-background);
  color: var(--text);
  margin-bottom: 1rem;
  padding: 1rem;
}

.centroid-meta {
  color: var(--text);
}

.coordinate-error {
  display: inline-flex;
  left: 0;
  position: absolute;
  top: 5rem;
  width: fit-content;
  z-index: 2;
}
</style>
