<script setup>
import { computed, ref } from 'vue'
import {
  coordinateInputToDegrees,
  raDegreesToSexagesimal,
  decDegreesToSexagesimal,
  raSexagesimalToDegrees,
  decSexagesimalToDegrees,
} from '@/utils/coordinates'

const props = defineProps({
  value: {
    type: [Number, String],
    required: true,
  },
  axis: {
    type: String,
    required: true,
  },
})

const sexagesimal = ref(false)

const degrees = computed(() => {
  return props.axis === 'ra'
    ? coordinateInputToDegrees(props.value, raSexagesimalToDegrees)
    : coordinateInputToDegrees(props.value, decSexagesimalToDegrees)
})

const text = computed(() => {
  if (sexagesimal.value) {
    return props.axis === 'ra'
      ? raDegreesToSexagesimal(degrees.value)
      : decDegreesToSexagesimal(degrees.value)
  }
  return `${degrees.value.toFixed(6)}°`
})
</script>

<template>
  <button
    type="button"
    class="coordinate-value"
    @click="sexagesimal = !sexagesimal"
  >
    {{ text }}
  </button>
</template>

<style scoped>
.coordinate-value {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
}
</style>
