<script setup>
import { computed, ref, watch } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useThumbnailsStore } from '@/stores/thumbnails'
import ImageViewer from '@/components/Analysis/ImageViewer.vue'
import HistogramSlider from '@/components/Global/Scaling/HistogramSlider.vue'
import { useImageScaling } from '@/components/Global/Scaling/useImageScaling'
import { fetchApiCall } from '@/utils/api'
import { ensureLargeCachedUrl } from '@/utils/common'
import { imagePixelScaleArcsec } from '@/utils/wcs'
import { dateToMjd } from '@/utils/formatDate'

const APERTURE_RADIUS_KEYS = {
  apertureRadius: 'radius',
  annulusInnerRadius: 'r_back1',
  annulusOuterRadius: 'r_back2',
}
import {
  coordinateInputToDegrees,
  raDegreesToSexagesimal,
  decDegreesToSexagesimal,
  raSexagesimalToDegrees,
  decSexagesimalToDegrees,
} from '@/utils/coordinates'

const configStore = useConfigurationStore()
const thumbnailsStore = useThumbnailsStore()

const source = defineModel({
  type: Object,
  required: true,
}, {
  type: Object,
  required: true,
})

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  images: {
    type: Array,
    default: () => [],
  },
  enableCentroiding: {
    type: Boolean,
    default: false,
  },
  hasImageInputs: {
    type: Boolean,
    default: false,
  },
  apertureRadii: {
    type: Object,
    default: null,
  },
  aperturePixelRadii: {
    type: Object,
    default: null,
  },
  syncPixelRadii: {
    type: Boolean,
    default: false,
  },
  apertureInputEditSequence: {
    type: Number,
    default: 0,
  },
  nameLookup: {
    type: Boolean,
    default: true,
  },
  includeMjd: {
    type: Boolean,
    default: false,
  },
  resetOnImageChange: {
    type: Boolean,
    default: false,
  },
  preserveApertureRadiiOnSelect: {
    type: Boolean,
    default: false,
  },
  targetPositionAction: {
    type: String,
    default: '',
  },
  coordinateReadOnly: {
    type: Boolean,
    default: false,
  },
  centroidRegion: {
    type: Object,
    default: null,
  },
  showCentroidPanel: {
    type: Boolean,
    default: true,
  },
})
const emit = defineEmits(['updateApertureRadii', 'updateAperturePixelRadii', 'updateCentroidRegion'])


const loading = ref(false)
const targetNameError = ref('')
const coordinateError = ref('')
const selectedImageUrl = ref('')
let loadedImageBasename = ''
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

const fitsImages = computed(() => props.images.filter((image) => image.basename))
const selectedImage = computed(() => fitsImages.value[0])
const displayImageUrl = computed(() => scaledImageUrl.value || selectedImageUrl.value)
const coordinateColumnWidth = computed(() => props.nameLookup ? 4 : 6)
const enableTargetSelection = computed(() => props.enableCentroiding && !props.coordinateReadOnly)

const apertureCenterCoordinate = computed(() => {
  if (source.value.ra == null || source.value.dec == null) return null
  return { ra: source.value.ra, dec: source.value.dec }
})

async function performTargetLookup() {
  if (source.value.name) {
    loading.value = true
    targetNameError.value = ''
    const url =  configStore.simbad2kUrl + source.value.name + '?target_type=SIDEREAL' 
    try {
      const response = await fetch(url)
      if (!response.ok) {
        loading.value = false
        targetNameError.value = 'Failed Target name lookup'
      }
      else {
        const result = await response.json()
        if (result.error) {
          targetNameError.value = result.error
        }
        if (result.ra !== undefined) {
          source.value.ra = raDegreesToSexagesimal(coordinateInputToDegrees(result.ra, raSexagesimalToDegrees))
        }
        if (result.dec !== undefined) {
          source.value.dec = decDegreesToSexagesimal(coordinateInputToDegrees(result.dec, decSexagesimalToDegrees))
        }
        loading.value = false
      }
    } catch (error) {
      loading.value = false
      targetNameError.value = error
    }
  }
}

watch(selectedImage, async (image) => {
  if (!image) {
    selectedImageUrl.value = ''
    wcsSolution.value = null
    localCentroidRegion.value = null
    centroidResult.value = null
    if (props.resetOnImageChange) {
      source.value = {}
    }
    resetImageScaling()
    return
  }

  selectedImageUrl.value = await ensureLargeCachedUrl(image, thumbnailsStore.cacheImage, configStore.archiveType)
  wcsSolution.value = null
  localCentroidRegion.value = props.centroidRegion
  centroidResult.value = null
  const imageChanged = loadedImageBasename && loadedImageBasename !== image.basename
  syncImageSource(image, imageChanged)
  loadedImageBasename = image.basename
  syncImageSource(image)
  if (props.targetPositionAction) {
    requestAnalysis(props.targetPositionAction)
  }
  await loadScaledImage(image, selectedImageUrl.value)
}, { immediate: true })

watch(() => props.apertureRadii, () => {
  syncCentroidRegionRadii()
}, { deep: true })

watch(() => props.aperturePixelRadii, () => {
  syncCentroidRegionRadii()
}, { deep: true })

watch(() => props.apertureInputEditSequence, () => {
  updateSharedPixelRadii()
})

watch(wcsSolution, () => {
  syncCentroidRegionRadii()
  if (localCentroidRegion.value && !props.preserveApertureRadiiOnSelect) {
    updateApertureInputs(localCentroidRegion.value)
  }
})

function requestAnalysis(action, input={}) {
  const url = configStore.datalabApiBaseUrl + 'analysis/' + action + '/'
  const body = {
    basename: selectedImage.value.basename,
    source: selectedImage.value.source,
    ...input
  }

  fetchApiCall({
    url,
    method: 'POST',
    body,
    successCallback: (response) => handleAnalysisOutput(response, action),
  })
}

function handleAnalysisOutput(response, action) {
  if (action === 'wcs') {
    wcsSolution.value = response
    return
  }

  if (action === props.targetPositionAction) {
    source.value = {
      ...source.value,
      ra: response.ra,
      dec: response.dec,
    }
    return
  }

  if (action === 'centroiding') {
    centroidResult.value = response
    if (!response.success) return

    source.value.ra = response.ra
    source.value.dec = response.dec
    const region = {
      ...localCentroidRegion.value,
      x: response.x,
      y: response.y,
      ra: response.ra,
      dec: response.dec,
    }
    localCentroidRegion.value = region
    emit('updateCentroidRegion', region)
    updateApertureInputs(region)
  }
}

function updateCentroidRegion(region, reason) {
  localCentroidRegion.value = region
  emit('updateCentroidRegion', region)
  centroidResult.value = null

  if (!props.coordinateReadOnly && region.ra != null && region.dec != null) {
    source.value.ra = region.ra
    source.value.dec = region.dec
  }

  if (props.preserveApertureRadiiOnSelect && reason === 'resize') {
    updateAperturePixels(region)
  }

  if (!props.preserveApertureRadiiOnSelect || reason === 'resize') {
    updateApertureInputs(region)
  }
  else if (props.syncPixelRadii && props.apertureRadii) {
    updateSharedPixelRadii(region)
  }
}

function updateCoordinateValidation(validation) {
  coordinateError.value = validation?.error || ''
  if (!validation?.region) return

  localCentroidRegion.value = {
    ...localCentroidRegion.value,
    ...validation.region,
  }
  emit('updateCentroidRegion', localCentroidRegion.value)
}

function requestCentroid() {
  requestAnalysis('centroiding', {
    x: localCentroidRegion.value.x,
    y: localCentroidRegion.value.y,
    width: localCentroidRegion.value.width,
    height: localCentroidRegion.value.height,
    radius: localCentroidRegion.value.radius,
    r_back1: localCentroidRegion.value.r_back1,
    r_back2: localCentroidRegion.value.r_back2,
    find_centroid: true,
    remove_background_stars: true,
    use_plane_background: usePlaneBackground.value,
  })
}

function updateApertureInputs(region) {
  if (!wcsSolution.value) return

  emit('updateApertureRadii', apertureRadiiFromRegion(region))
}

function syncCentroidRegionRadii() {
  if (!localCentroidRegion.value) return

  const radii = centroidPixelRadii()
  if (!radii) return

  localCentroidRegion.value = {
    ...localCentroidRegion.value,
    radius: radii.apertureRadius,
    r_back1: radii.annulusInnerRadius,
    r_back2: radii.annulusOuterRadius,
  }
  emit('updateCentroidRegion', localCentroidRegion.value)
}

function updateAperturePixels(region) {
  emit('updateAperturePixelRadii', pixelRadiiFromRegion(region))
}

function centroidPixelRadii() {
  if (props.aperturePixelRadii) {
    return props.aperturePixelRadii
  }
  if (!props.apertureRadii || !wcsSolution.value) {
    return null
  }
  return aperturePixelRadiiFromInputs(localCentroidRegion.value)
}

function apertureRadiiFromRegion(region) {
  return Object.fromEntries(
    Object.entries(APERTURE_RADIUS_KEYS).map(([radiusKey, regionKey]) => {
      return [radiusKey, arcsecRadius(region[regionKey], region)]
    })
  )
}

function pixelRadiiFromRegion(region) {
  return Object.fromEntries(
    Object.entries(APERTURE_RADIUS_KEYS).map(([radiusKey, regionKey]) => {
      return [radiusKey, region[regionKey]]
    })
  )
}

function aperturePixelRadiiFromInputs(region) {
  return Object.fromEntries(
    Object.keys(APERTURE_RADIUS_KEYS).map((radiusKey) => {
      return [radiusKey, pixelRadius(props.apertureRadii[radiusKey], region)]
    })
  )
}

function updateSharedPixelRadii(region = localCentroidRegion.value) {
  if (!props.syncPixelRadii || !region || !props.apertureRadii || !wcsSolution.value) return

  emit('updateAperturePixelRadii', aperturePixelRadiiFromInputs(region))
}


function arcsecRadius(radius, region) {
  return Math.round(radius * pixelScale(region) * 100) / 100
}

function pixelRadius(radius, region) {
  return radius / pixelScale(region)
}

function pixelScale(region) {
  return imagePixelScaleArcsec(wcsSolution.value, region.width, region.height)
}

function syncImageSource(image, imageChanged) {
  if (props.resetOnImageChange && imageChanged) {
    source.value = props.includeMjd ? { mjd: dateToMjd(image.observation_date) } : {}
    return
  }

  if (props.includeMjd) {
    source.value = {
      ...source.value,
      mjd: dateToMjd(image.observation_date),
    }
  }
}

</script>
<template>
  <div class="source-input">
    <div
      v-if="title"
      class="source-title"
    >
      {{ title }}
    </div>
    <v-row>
      <v-col
        v-if="props.nameLookup"
        cols="12"
        md="4"
        class="pb-0"
      >
        <v-text-field
          v-model="source.name"
          :loading="loading"
          :error-messages="targetNameError"
          label="Source name"
          type="text"
          append-inner-icon="mdi-magnify"
          @click:append-inner="performTargetLookup"
        />
      </v-col>
      <v-col
        cols="12"
        :md="coordinateColumnWidth"
        class="pb-0"
      >
        <v-text-field
          :model-value="source.ra"
          label="Right Ascension"
          type="number"
          :readonly="coordinateReadOnly"
          @update:model-value="source.ra = $event === '' ? null : Number($event)"
        />
      </v-col>
      <v-col
        cols="12"
        :md="coordinateColumnWidth"
        class="pb-0"
      >
        <v-text-field
          :model-value="source.dec"
          label="Declination"
          type="number"
          :readonly="coordinateReadOnly"
          @update:model-value="source.dec = $event === '' ? null : Number($event)"
        />
      </v-col>
    </v-row>
    <v-alert
      v-if="coordinateError"
      class="mb-3"
      density="compact"
      type="warning"
      :text="coordinateError"
    />
    <v-row
      v-if="props.hasImageInputs || fitsImages.length > 0"
      class="source-picker-row"
    >
      <v-col
        cols="12"
        :md="props.enableCentroiding || imageScaleReady ? 8 : 12"
      >
        <v-alert
          v-if="!selectedImage"
          density="compact"
          type="info"
          text="Select a FITS input image to use centroiding."
        />
        <image-viewer
          v-if="selectedImage && displayImageUrl"
          :key="selectedImage.basename"
          v-model:centroid-tool-active="centroidToolActive"
          compact
          :enable-catalog="false"
          :enable-line-profile="false"
          :enable-centroid-tool="enableTargetSelection"
          :image-url="displayImageUrl"
          :reload-on-image-url-change="false"
          :wcs-solution="wcsSolution"
          :centroid-region="localCentroidRegion"
          :aperture-radii="apertureRadii"
          :aperture-pixel-radii="aperturePixelRadii"
          :aperture-center-coordinate="apertureCenterCoordinate"
          :preserve-aperture-radii-on-select="preserveApertureRadiiOnSelect"
          @analysis-action="requestAnalysis"
          @centroid-region-updated="updateCentroidRegion"
          @coordinate-validation-updated="updateCoordinateValidation"
        />
      </v-col>
      <v-col
        v-if="(props.enableCentroiding && props.showCentroidPanel) || imageScaleReady"
        cols="12"
        md="4"
      >
        <v-sheet
          v-if="enableCentroiding && showCentroidPanel"
          class="source-side-panel"
        >
          <div class="d-flex align-center ga-2 mb-3">
            <v-icon icon="mdi-vector-circle" />
            <b>Centroiding</b>
          </div>
          <div
            v-if="localCentroidRegion?.radius != null && localCentroidRegion?.r_back1 != null && localCentroidRegion?.r_back2 != null"
            class="centroid-meta"
          >
            <span>Radius: {{ localCentroidRegion.radius.toFixed(2) }} px</span>
            <span>Inner annulus: {{ localCentroidRegion.r_back1.toFixed(2) }} px</span>
            <span>Outer annulus: {{ localCentroidRegion.r_back2.toFixed(2) }} px</span>
          </div>
          <v-checkbox
            v-if="!coordinateReadOnly"
            v-model="usePlaneBackground"
            color="var(--primary-interactive)"
            density="comfortable"
            hide-details
            label="Plane background removal"
          />
          <v-btn
            v-if="!coordinateReadOnly"
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
            <template v-if="centroidResult.success">
              <span>RA: {{ Number(centroidResult.ra).toFixed(6) }}</span>
              <span>Dec: {{ Number(centroidResult.dec).toFixed(6) }}</span>
            </template>
            <span v-else>{{ centroidResult.error || centroidResult.message }}</span>
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
            :color="{ r: 255, g: 255, b: 255 }"
            @update-scaling="updateScaling"
          />
        </v-sheet>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.source-input {
  width: 100%;
}

.source-picker-row {
  margin-top: 0.25rem;
}

.source-title {
  color: var(--text);
  font-weight: 600;
  margin: 0.5rem 0;
}

.source-side-panel {
  background-color: var(--card-background);
  color: var(--text);
  border-radius: 0.25rem;
  margin-bottom: 1rem;
  padding: 1rem;
}

.centroid-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--text);
  font-size: 0.9rem;
}
</style>
