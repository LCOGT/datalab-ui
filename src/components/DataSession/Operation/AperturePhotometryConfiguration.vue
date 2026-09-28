<script setup>
import { computed, ref } from 'vue'
import MultiImageInputSelector from '@/components/DataSession/Operation/MultiImageInputSelector.vue'
import ApertureSourceEditor from '@/components/DataSession/Operation/ApertureSourceEditor.vue'

const APERTURE_INPUT_KEYS = {
  apertureRadius: 'aperture_radius',
  annulusInnerRadius: 'annulus_inner_radius',
  annulusOuterRadius: 'annulus_outer_radius',
}
const TARGET_POSITIONS_TYPE = 'target_positions'
const TABS = {
  SELECT_IMAGES: 'select-images',
  APERTURE: 'aperture',
  FIRST_APERTURE: 'first-aperture',
  LAST_APERTURE: 'last-aperture',
}

const operationInputs = defineModel({
  type: Object,
  required: true,
})

const props = defineProps({
  inputDescriptions: {
    type: Object,
    required: true,
  },
  images: {
    type: Array,
    required: true,
  },
  maxInputs: {
    type: Number,
    required: true,
  },
  minInputs: {
    type: Number,
    required: true,
  },
})

const activeTab = ref(TABS.SELECT_IMAGES)
const previewBasename = ref('')
const movingAperturePixelRadii = ref(null)
const centroidRegions = ref({})
const headerSource = ref({})

const imageInputDescriptions = computed(() => {
  return Object.fromEntries(
    Object.entries(props.inputDescriptions).filter(([, description]) => description.type === 'fits')
  )
})

const targetPositionEntry = computed(() => {
  return Object.entries(props.inputDescriptions).find(([, description]) => {
    return description.type === TARGET_POSITIONS_TYPE
  })
})

const targetPositionKey = computed(() => {
  return targetPositionEntry.value?.[0]
})

const targetPositionDescription = computed(() => {
  return targetPositionEntry.value?.[1]
})

const isMovingTarget = computed(() => {
  return (targetPositionDescription.value?.minimum || 0) > 1
})

const usesHeaderPosition = computed(() => {
  return !targetPositionEntry.value
})

const apertureRadii = computed(() => {
  return Object.fromEntries(
    Object.entries(APERTURE_INPUT_KEYS).map(([radiusKey, inputKey]) => {
      return [radiusKey, operationInputs.value[inputKey]]
    })
  )
})

const selectedImages = computed(() => {
  const selected = []
  Object.keys(imageInputDescriptions.value).forEach(inputKey => {
    selected.push(...operationInputs.value[inputKey])
  })
  return selected
})

const sortedSelectedImages = computed(() => {
  return [...selectedImages.value].sort((first, second) => {
    return new Date(first.observation_date) - new Date(second.observation_date)
  })
})

const previewImage = computed(() => {
  return selectedImages.value.find(image => image.basename === previewBasename.value) || selectedImages.value[0]
})

const firstImage = computed(() => {
  return sortedSelectedImages.value[0]
})

const lastImage = computed(() => {
  return sortedSelectedImages.value.at(-1)
})

const tabs = computed(() => {
  const apertureTabs = isMovingTarget.value
    ? [
      { value: TABS.FIRST_APERTURE, title: 'First Image Aperture Settings' },
      { value: TABS.LAST_APERTURE, title: 'Last Image Aperture Settings' },
    ]
    : [{ value: TABS.APERTURE, title: 'Aperture Settings' }]

  return [
    { value: TABS.SELECT_IMAGES, title: 'Select Images' },
    ...apertureTabs,
  ]
})

function setImages(inputKey, images) {
  operationInputs.value[inputKey] = [...images]
}

function insertImage(inputKey, image) {
  const inputImages = operationInputs.value[inputKey]
  const maximum = imageInputDescriptions.value[inputKey].maximum
  if (inputImages.includes(image)) return

  if (inputImages.length >= maximum) {
    inputImages.pop()
  }
  inputImages.push(image)
}

function removeImage(inputKey, image) {
  const inputImages = operationInputs.value[inputKey]
  inputImages.splice(inputImages.indexOf(image), 1)
}

function selectPreviewImage(image) {
  previewBasename.value = image.basename
}

function updateApertureRadii(radii) {
  Object.entries(APERTURE_INPUT_KEYS).forEach(([radiusKey, inputKey]) => {
    operationInputs.value[inputKey] = radii[radiusKey]
  })
}

function updateAperturePixelRadii(radii) {
  movingAperturePixelRadii.value = { ...radii }
}

function updateCentroidRegion(key, region) {
  centroidRegions.value[key] = region
}

function targetPosition(index) {
  return operationInputs.value[targetPositionKey.value][index]
}

function updateTargetPosition(index, position) {
  operationInputs.value[targetPositionKey.value][index] = position
}

</script>

<template>
  <div>
    <v-tabs
      v-model="activeTab"
      class="tabs mb-0"
      grow
    >
      <v-tab
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :class="{ 'configure-tab-active': activeTab === tab.value }"
      >
        {{ tab.title }}
      </v-tab>
    </v-tabs>

    <div class="configure-tab-panel">
      <keep-alive>
        <multi-image-input-selector
          v-if="activeTab === TABS.SELECT_IMAGES"
          :input-descriptions="imageInputDescriptions"
          :input-images="operationInputs"
          :images="props.images"
          :max-inputs="props.maxInputs"
          :min-inputs="props.minInputs"
          @set-images="setImages"
          @insert-image="insertImage"
          @remove-image="removeImage"
          @select-image="selectPreviewImage"
        />
      </keep-alive>

      <aperture-source-editor
        v-if="activeTab === TABS.APERTURE && usesHeaderPosition"
        v-model="headerSource"
        title="Aperture Settings"
        :image="previewImage"
        :aperture-radii="apertureRadii"
        :centroid-region="centroidRegions.header"
        coordinate-read-only
        @update-aperture-radii="updateApertureRadii"
        @update-centroid-region="updateCentroidRegion('header', $event)"
      />

      <aperture-source-editor
        v-if="activeTab === TABS.APERTURE && !usesHeaderPosition"
        :model-value="targetPosition(0)"
        title="Aperture Settings"
        :image="previewImage"
        :aperture-radii="apertureRadii"
        :centroid-region="centroidRegions.target"
        :name-lookup="targetPositionDescription.name_lookup === true"
        @update:model-value="updateTargetPosition(0, $event)"
        @update-aperture-radii="updateApertureRadii"
        @update-centroid-region="updateCentroidRegion('target', $event)"
      />

      <aperture-source-editor
        v-if="activeTab === TABS.FIRST_APERTURE"
        :model-value="targetPosition(0)"
        title="First Image Aperture Settings"
        :image="firstImage"
        :aperture-radii="apertureRadii"
        :aperture-pixel-radii="movingAperturePixelRadii"
        :centroid-region="centroidRegions.first"
        include-mjd
        preserve-aperture-radii
        sync-pixel-radii
        @update:model-value="updateTargetPosition(0, $event)"
        @update-aperture-radii="updateApertureRadii"
        @update-aperture-pixel-radii="updateAperturePixelRadii"
        @update-centroid-region="updateCentroidRegion('first', $event)"
      />

      <aperture-source-editor
        v-if="activeTab === TABS.LAST_APERTURE"
        :model-value="targetPosition(1)"
        title="Last Image Aperture Settings"
        :image="lastImage"
        :aperture-radii="apertureRadii"
        :aperture-pixel-radii="movingAperturePixelRadii"
        :centroid-region="centroidRegions.last"
        include-mjd
        preserve-aperture-radii
        sync-pixel-radii
        @update:model-value="updateTargetPosition(1, $event)"
        @update-aperture-radii="updateApertureRadii"
        @update-aperture-pixel-radii="updateAperturePixelRadii"
        @update-centroid-region="updateCentroidRegion('last', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.configure-tab-panel {
  border: 1px solid var(--secondary-background);
  min-height: 36rem;
  padding: 1rem;
}

.configure-tab-active {
  background-color: var(--primary-interactive);
  color: var(--text);
}

</style>
