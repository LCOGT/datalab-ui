<script setup>
import { ref, watch } from 'vue'

/**
 * Non Linear modification of the Vuetify range slider
 * Props:
 * - min: Minimum value of the range
 * - max: Maximum value of the range
 * - stepCount: Number of steps to use in the range slider, default is 200, higher values will result in a smoother slider
 * - scaling: The scaling function to use, default is log10
 */

const props = defineProps({
  min: {
    type: Number,
    default: 0,
    required: true
  },
  max: {
    type: Number,
    required: true
  },
  stepCount: {
    type: Number,
    default: 200,
    required: false,
  },
  scaling: {
    type: Function,
    default: (index, stepCount, max) => Math.floor(Math.pow(10, index * Math.log10(max) / stepCount)),
    required: false,
  },
  disabled: {
    type: Boolean,
    default: false,
    required: false,
  }
})

const customScale = ref([])
const sliderRange = ref([])
const fluxRange = defineModel({ type: Array })

function updateRange() {
  // Mapping the range slider values to the custom scale
  const [start, end] = sliderRange.value
  fluxRange.value = [customScale.value[start], customScale.value[end]]
}

function updateSlider() {
  // Find the closest index in the custom scale for the scaled range values
  const [startValue, endValue] = fluxRange.value
  const startIndex = customScale.value.findIndex(value => value >= startValue)
  const endIndex = customScale.value.findIndex(value => value >= endValue)
  sliderRange.value = [startIndex, endIndex]
}

function calcCustomScale(){
  customScale.value = Array.from({length: props.stepCount}, (_, i) => props.scaling(i, props.stepCount, props.max))

  // Calculation could result in last value being less than max, so we add the max value to the scale
  if (customScale.value.at(-1) < props.max) {
    customScale.value.push(props.max)
  }

  // Clips the custom scale to the min value
  const minIndex = customScale.value.findIndex((value) => value >= props.min)-1
  if (minIndex > 0){ customScale.value.splice(0, minIndex) }
}

watch(() => [props.max, props.min], () => {
  calcCustomScale()

  // Set the initial range selection on the slider to the ends
  sliderRange.value = [0, customScale.value.length-1]

  updateRange()
},{ immediate: true })

</script>
<template>
  <v-range-slider
    v-model="sliderRange"
    step="1"
    :disabled="disabled"
    :max="customScale.length-1"
    color="var(--primary-interactive)"
    thumb-color="var(--secondary-interactive)"
    strict
    hide-details
    @update:model-value="updateRange"
  >
    <template #prepend>
      <v-text-field
        v-model="fluxRange[0]"
        class="custom-text-field"
        density="compact"
        :style="{ width: '6rem' }"
        hide-spin-buttons
        type="number"
        variant="solo-filled"
        bg-color="var(--card-background)"
        hide-details
        single-line
        @update:model-value="updateSlider"
      />
    </template>
    <template #append>
      <v-text-field
        v-model="fluxRange[1]"
        class="custom-text-field"
        density="compact"
        :style="{ width: '6rem' }"
        hide-spin-buttons
        type="number"
        variant="solo-filled"
        bg-color="var(--card-background)"
        hide-details
        single-line
        @update:model-value="updateSlider"
      />
    </template>
  </v-range-slider>
</template>
<style scoped>
</style>
