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
    default: 'var(--primary-interactive)'
  },
})

const emit = defineEmits(['updateScaling'])

const scaleRange = ref([props.bins[0], props.bins[props.bins.length-1]])
const sliderRange = ref([0, props.bins.length-1])
const backgroundColor = 'var(--text)'

const gradient = computed(() => {
  const { bins, selectedColor } = props
  const [start, end] = sliderRange.value
  
  // Initialize array with background color
  const gradientArray = new Array(bins.length).fill(backgroundColor)
  
  // Fill selected range
  gradientArray.fill(selectedColor, Math.max(0, start), Math.min(bins.length, end + 1))

  return gradientArray
})

function sliderToBinValue(sliderValue) {
  return props.bins[sliderValue] ?? console.error('Slider value out of bounds')
}

/**
 * Maps a scale value (zmin/zmax) to a slider value (0 to bins.length-1)
 * So when a scale value is changed with the number fields,
 * it maps to the closest slider position.
 * @param {number} scaleValue 
 * @returns {number}
 */
function scaleToSliderValue(scaleValue) {
  const { bins } = props
  let left = 0, right = bins.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (bins[mid] === scaleValue) return mid
    if (bins[mid] < scaleValue) left = mid + 1
    else right = mid - 1
  }

  // Return the closest index
  return Math.abs(bins[left] - scaleValue) < Math.abs(bins[right] - scaleValue) ? left : right
}

function updateScaleRange() {
  // This is called when the range slider control is moved
  scaleRange.value[0] = sliderToBinValue(sliderRange.value[0])
  scaleRange.value[1] = sliderToBinValue(sliderRange.value[1])
  emit('updateScaling', ...scaleRange.value)
}

function updateLowerScale(value) {
  // This is called when a change is made on the lower point number control
  value = Number(value)
  scaleRange.value[0] = value
  sliderRange.value[0] = scaleToSliderValue(value)
  emit('updateScaling', ...scaleRange.value)
}

function updateUpperScale(value) {
  // This is called when a change is made on the upper point number control
  value = Number(value)
  scaleRange.value[1] = value
  sliderRange.value[1] = scaleToSliderValue(value)
  emit('updateScaling', ...scaleRange.value)
}

function zScaleImage() {
  // This is called to reset the ranges to the zMin/zMax
  scaleRange.value = [props.zMin, props.zMax]
  sliderRange.value = [scaleToSliderValue(props.zMin), scaleToSliderValue(props.zMax)]
  emit('updateScaling', ...scaleRange.value)
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
        variant="solo-filled"
        bg-color="var(--card-background)"
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
        variant="solo-filled"
        bg-color="var(--card-background)"
        hide-spin-buttons
        hide-details
        @update:model-value="updateUpperScale"
      />
    </v-col>
    <v-col>
      <v-btn
        color="var(--primary-interactive)"
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
      :ripple="false"
      track-size="0"
      :track-color="backgroundColor"
      :track-fill-color="selectedColor"
      thumb-color="var(--secondary-interactive)"
      :max="props.bins.length-1"
      strict
      hide-details
      @update:model-value="updateScaleRange"
    />
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
