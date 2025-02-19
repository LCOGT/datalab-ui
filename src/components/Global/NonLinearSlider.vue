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
  }
})

const scaledRange = defineModel({ type: Array })

const customScale = ref([])
const sliderRange = ref([])

function updateRange() {
  // Mapping the range slider values to the custom scale
  const [start, end] = sliderRange.value
  scaledRange.value = [customScale.value[start], customScale.value[end]]
}

function calcCustomScale(){

  customScale.value = Array.from({length: props.stepCount}, (_, i) => props.scaling(i, props.stepCount, props.max))

  // Calculation could result in last value being less than max, so we add the max value to the scale
  if (customScale.value.at(-1) < props.max) {
    customScale.value.push(props.max)
  }

  // Clips the custom scale to the min value
  customScale.value.splice(0, customScale.value.findIndex((value) => value >= props.min)-1)
}

watch(() => [props.max, props.min], () => {

  calcCustomScale()

  // Set the initial range selection on the slider to the ends
  scaledRange.value = [customScale.value[0], customScale.value[customScale.value.length-1]]
  sliderRange.value = [0, customScale.value.length-1]

  updateRange()
},{ immediate: true })

</script>
<template>
  <v-range-slider
    v-model="sliderRange"
    step="1"
    :max="customScale.length-1"
    color="var(--light-blue)"
    thumb-color="var(--dark-green)"
    strict
    hide-details
    @update:model-value="updateRange"
  />
</template>
<style scoped>
</style>
