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

const configStore = useConfigurationStore()
const thumbnailsStore = useThumbnailsStore()

const source = defineModel({
  type: Object,
  required: true,
})

const props = defineProps({
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
})
const emit = defineEmits(['updateApertureRadii'])

const loading = ref(false)
const targetNameError = ref('')
const selectedImageUrl = ref('')
const wcsSolution = ref(null)
const centroidRegion = ref(null)
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
        if (result.dec) {
          source.value.dec = result.dec
        }
        if (result.ra) {
          source.value.ra = result.ra
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
    centroidRegion.value = null
    centroidResult.value = null
    resetImageScaling()
    return
  }

  selectedImageUrl.value = await ensureLargeCachedUrl(image, thumbnailsStore.cacheImage, configStore.archiveType)
  wcsSolution.value = null
  centroidRegion.value = null
  centroidResult.value = null
  await loadScaledImage(image, selectedImageUrl.value)
}, { immediate: true })

watch(() => props.apertureRadii, () => {
  syncCentroidRegionRadii()
}, { deep: true })

watch(wcsSolution, () => {
  syncCentroidRegionRadii()
  if (centroidRegion.value) {
    updateApertureInputs(centroidRegion.value)
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

  if (action === 'centroiding') {
    centroidResult.value = response
    if (!response.success) return

    source.value.ra = response.ra
    source.value.dec = response.dec
    const region = {
      ...centroidRegion.value,
      x: response.x,
      y: response.y,
      ra: response.ra,
      dec: response.dec,
    }
    centroidRegion.value = region
    updateApertureInputs(region)
  }
}

function updateCentroidRegion(region) {
  centroidRegion.value = region
  centroidResult.value = null

  if (region.ra != null && region.dec != null) {
    source.value.ra = region.ra
    source.value.dec = region.dec
  }

  updateApertureInputs(region)
}

function requestCentroid() {
  requestAnalysis('centroiding', {
    x: centroidRegion.value.x,
    y: centroidRegion.value.y,
    width: centroidRegion.value.width,
    height: centroidRegion.value.height,
    radius: centroidRegion.value.radius,
    r_back1: centroidRegion.value.r_back1,
    r_back2: centroidRegion.value.r_back2,
    find_centroid: true,
    remove_background_stars: true,
    use_plane_background: usePlaneBackground.value,
  })
}

function updateApertureInputs(region) {
  if (!wcsSolution.value) return

  emit('updateApertureRadii', {
    apertureRadius: arcsecRadius(region.radius, region),
    annulusInnerRadius: arcsecRadius(region.r_back1, region),
    annulusOuterRadius: arcsecRadius(region.r_back2, region),
  })
}

function syncCentroidRegionRadii() {
  if (!centroidRegion.value || !props.apertureRadii || !wcsSolution.value) return

  centroidRegion.value = {
    ...centroidRegion.value,
    radius: pixelRadius(props.apertureRadii.apertureRadius),
    r_back1: pixelRadius(props.apertureRadii.annulusInnerRadius),
    r_back2: pixelRadius(props.apertureRadii.annulusOuterRadius),
  }
}

function arcsecRadius(radius, region) {
  return Math.round(radius * pixelScale(region) * 1000) / 1000
}

function pixelRadius(radius) {
  return radius / pixelScale(centroidRegion.value)
}

function pixelScale(region) {
  return imagePixelScaleArcsec(wcsSolution.value, region.width, region.height)
}

</script>
<template>
  <div class="source-input">
    <v-row>
      <v-col
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
        md="4"
        class="pb-0"
      >
        <v-text-field
          :model-value="source.ra"
          label="Right Ascension"
          type="number"
          @update:model-value="source.ra = $event === '' ? null : Number($event)"
        />
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="pb-0"
      >
        <v-text-field
          :model-value="source.dec"
          label="Declination"
          type="number"
          @update:model-value="source.dec = $event === '' ? null : Number($event)"
        />
      </v-col>
    </v-row>
    <v-row
      v-if="props.hasImageInputs || fitsImages.value.length > 0"
      class="source-picker-row"
    >
      <v-col
        cols="12"
        :md="props.enableCentroiding || imageScaleReady.value ? 8 : 12"
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
          :enable-centroid-tool="enableCentroiding"
          :image-url="displayImageUrl"
          :reload-on-image-url-change="false"
          :wcs-solution="wcsSolution"
          :centroid-region="centroidRegion"
          :aperture-radii="apertureRadii"
          :aperture-center-coordinate="apertureCenterCoordinate"
          @analysis-action="requestAnalysis"
          @centroid-region-updated="updateCentroidRegion"
        />
      </v-col>
      <v-col
        v-if="props.enableCentroiding || imageScaleReady.value"
        cols="12"
        md="4"
      >
        <v-sheet
          v-if="enableCentroiding"
          class="source-side-panel"
        >
          <div class="d-flex align-center ga-2 mb-3">
            <v-icon icon="mdi-vector-circle" />
            <b>Centroiding</b>
          </div>
          <div
            v-if="centroidRegion"
            class="centroid-meta"
          >
            <span>Radius: {{ centroidRegion.radius.toFixed(2) }} px</span>
            <span>Inner annulus: {{ centroidRegion.r_back1.toFixed(2) }} px</span>
            <span>Outer annulus: {{ centroidRegion.r_back2.toFixed(2) }} px</span>
          </div>
          <v-checkbox
            v-model="usePlaneBackground"
            color="var(--primary-interactive)"
            density="comfortable"
            hide-details
            label="Plane background removal"
          />
          <v-btn
            class="mt-3"
            color="var(--primary-interactive)"
            :disabled="!centroidRegion?.ready"
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
