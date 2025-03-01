<script setup>
import { ref, defineProps, defineEmits, computed, watch } from 'vue'

// This component draws a sparkline histogram with range slider controls on top of it.
// It has two coordinate systems - sliderRange which is a linear system of bins for the
// histogram passed in, with bin middles defined by a same-sized array bins, and scaleRange
// which is the actual lower/upper point values in pixel space. You can get better granularity
// on changing scaleRange with the number fields, since that can change to any value in the range
// vs using the histogram slider which has steps according to the highly non-linear bins used
// to generate the histogram.

const props = defineProps({
  histogram: {
    type: Array,
    required: true
  },
  bins: {
    type: Array,
    required: true
  },
  maxValue: {
    type: Number,
    required: false,
    default: 65500
  },
  zMin: {
    type: Number,
    required: false,
    default: 0
  },
  zMax: {
    type: Number,
    required: false,
    default: 65500
  },
  selectedColor: {
    type: String,
    required: false,
    default: 'var(--light-blue)'
  },
})

const emit = defineEmits(['updateScaling'])

const scaleRange = ref([props.bins[0], props.bins[props.bins.length-1]])
const sliderRange = ref([0, props.bins.length-1])
const backgroundColor = 'var(--light-gray)'

const gradient = computed(() => {
  // This function computes a "gradient" for the histogram sparkline, showing the selected region as highlighted
  let gradientArray = []
  for (let i = 0; i < props.bins.length; i++) {
    if (i > (sliderRange.value[0]+1) && i < (sliderRange.value[1]-1)) {
      gradientArray.push(props.selectedColor)
    }
    else {
      gradientArray.push(backgroundColor)
    }
  }
  return gradientArray
})

function sliderToBinValue(sliderValue) {
  // This converts from sliderRange coordinates to scaleRange coordinates
  if (props.bins.length >= sliderValue) {
    return props.bins[sliderValue]
  }
}

// Convert the slider value (bins) to the scale value (zMin/zMax)
function labelSliderToScaleValue(sliderValue) {
  if (sliderValue == sliderRange.value[0]) {
    return scaleRange.value[0]
  }
  return scaleRange.value[1]
}

/**
 * Maps a scale value (zmin/zmax) to a slider value (0 to bins.length-1)
 * So when a scale value is changed with the number fields,
 * it maps to the closest slider position.
 * @param {number} scaleValue 
 * @returns {number}
 */
function scaleToSliderValue(scaleValue) {
  // Determine whether start or end of the bin array is closer to the scale value and start from there
  const startIndex = Math.abs(scaleValue - props.zMin) > Math.abs(scaleValue - props.zMax) ? props.bins.length - 1 : 0
  const stepDirection = startIndex === 0 ? 1 : -1

  let previousDistance = Math.abs(scaleValue - props.bins[startIndex])

  // Iterate until you find the closest bin to the scale value
  for (let i = startIndex + stepDirection; i >= 0 && i < props.bins.length; i += stepDirection) {
    let distance = Math.abs(scaleValue - props.bins[i])
    if (distance > previousDistance) return i - stepDirection
    else previousDistance = distance
  }

  // If no closer bin found, return the start or end of the bin array
  return startIndex === 0 ? props.bins.length - 1 : 0
}

function updateScaleRange() {
  // This is called when the range slider control is moved
  scaleRange.value[0] = sliderToBinValue(sliderRange.value[0])
  scaleRange.value[1] = sliderToBinValue(sliderRange.value[1])
  emit('updateScaling', scaleRange.value[0], scaleRange.value[1])
}

function updateLowerScale(value) {
  // This is called when a change is made on the lower point number control
  scaleRange.value = [Number(value), scaleRange.value[1]]
  sliderRange.value[0] = scaleToSliderValue(Number(value))
  emit('updateScaling', scaleRange.value[0], scaleRange.value[1])
}

function updateUpperScale(value) {
  // This is called when a change is made on the upper point number control
  scaleRange.value = [scaleRange.value[0], Number(value)]
  sliderRange.value[1] = scaleToSliderValue(Number(value))
  emit('updateScaling', scaleRange.value[0], scaleRange.value[1])
}

function zScaleImage() {
  // This is called to reset the ranges to the zMin/zMax
  scaleRange.value = [props.zMin, props.zMax]
  sliderRange.value = [scaleToSliderValue(props.zMin), scaleToSliderValue(props.zMax)]
  emit('updateScaling', scaleRange.value[0], scaleRange.value[1])
}

watch(
  () => props.zMax, () => {
    zScaleImage()
  }, { immediate: true }
)

</script>
<template>
  <v-row class="histogram-range-controls mb-1">
    <v-col>
      <v-text-field
        v-model="scaleRange[0]"
        :min="0"
        label="z-min"
        density="compact"
        type="number"
        variant="outlined"
        bg-color="var(--dark-blue)"
        hide-spin-buttons
        hide-details
        @update:model-value="updateLowerScale"
      />
    </v-col>
    <v-col>
      <v-text-field
        v-model="scaleRange[1]"
        :max="props.maxValue"
        label="z-max"
        density="compact"
        type="number"
        variant="outlined"
        bg-color="var(--dark-blue)"
        hide-spin-buttons
        hide-details
        @update:model-value="updateUpperScale"
      />
    </v-col>
    <v-col>
      <v-btn
        color="var(--light-blue)"
        prepend-icon="mdi-refresh"
        text="Z-Scale"
        rounded="lg"
        @click="zScaleImage"
      />
    </v-col>
  </v-row>
  <div class="histogram-range-slider">
    <v-sparkline
      :smooth="true"
      :fill="true"
      line-width="0.1"
      height="50"
      :gradient="gradient"
      gradient-direction="left"
      :model-value="props.histogram"
      auto-draw
      padding="1"
    />
    <v-range-slider
      v-model="sliderRange"
      step="1"
      track-size="0"
      :track-color="backgroundColor"
      :track-fill-color="selectedColor"
      thumb-color="var(--dark-green)"
      thumb-size="16"
      thumb-label="always"
      :max="props.bins.length-1"
      strict
      hide-details
      @update:model-value="updateScaleRange"
    >
      <template #thumb-label="{ modelValue }">
        {{ labelSliderToScaleValue(modelValue) }}
      </template>
    </v-range-slider>
  </div>
</template>
<style scoped>
.histogram-range-slider {
  position: relative;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
}

.v-range-slider {
  position: relative;
  bottom: 17px;
}
</style>
