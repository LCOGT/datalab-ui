<script setup>
import { computed } from 'vue'
import { distanceParsecs } from '@/utils/isochrones.js'

/*
  Slider controls for the manual isochrone fit: distance modulus and reddening E(B-V) move
  the model polyline across the CMD, while log(age) and [Fe/H] snap to the nodes
  of the shipped isochrone grid and select which polyline is drawn (interpolating
  between isochrones distorts the turnoff, so v1 is snap-to-node by design). The
  parent owns the fit object and computes the placed polyline; this component only
  edits the fit parameters.
*/

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  // node values of the isochrone grid, sorted ascending
  logAgeNodes: {
    type: Array,
    required: true
  },
  fehNodes: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const MU_MIN = 0
const MU_MAX = 18
const MU_STEP = 0.05
const EBV_MIN = 0
const EBV_MAX = 2
const EBV_STEP = 0.01

function setField(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function nearestIndex(nodes, value) {
  let best = 0
  nodes.forEach((node, index) => {
    if (Math.abs(node - value) < Math.abs(nodes[best] - value)) best = index
  })
  return best
}

// the age and metallicity sliders move over node indices so every stop is a grid node
const logAgeIndex = computed(() => nearestIndex(props.logAgeNodes, props.modelValue.log_age))
const fehIndex = computed(() => nearestIndex(props.fehNodes, props.modelValue.feh))

const distanceText = computed(() => {
  const parsecs = distanceParsecs(props.modelValue.mu)
  return parsecs >= 1000 ? `${(parsecs / 1000).toFixed(2)} kpc` : `${Math.round(parsecs)} pc`
})

const ageText = computed(() => {
  const years = Math.pow(10, props.modelValue.log_age)
  return years >= 1e9 ? `${(years / 1e9).toFixed(1)} Gyr` : `${Math.round(years / 1e6)} Myr`
})
</script>
<template>
  <v-sheet
    class="isochrone-controls pa-3"
    color="var(--card-background)"
    rounded
  >
    <div class="controls-header">
      <span class="controls-title">ISOCHRONE FIT</span>
      <v-switch
        :model-value="props.modelValue.show"
        label="Show isochrone"
        color="var(--primary-interactive)"
        density="compact"
        hide-details
        class="show-switch"
        @update:model-value="setField('show', $event)"
      />
    </div>
    <div class="sliders">
      <div class="slider-block">
        <div class="slider-head">
          <span>distance modulus μ: {{ props.modelValue.mu.toFixed(2) }}</span>
          <span class="derived">{{ distanceText }}</span>
        </div>
        <v-slider
          :model-value="props.modelValue.mu"
          :min="MU_MIN"
          :max="MU_MAX"
          :step="MU_STEP"
          :disabled="!props.modelValue.show"
          color="var(--primary-interactive)"
          density="compact"
          hide-details
          @update:model-value="setField('mu', $event)"
        />
      </div>
      <div class="slider-block">
        <div class="slider-head">
          <span>reddening E(B-V): {{ props.modelValue.ebv.toFixed(2) }}</span>
        </div>
        <v-slider
          :model-value="props.modelValue.ebv"
          :min="EBV_MIN"
          :max="EBV_MAX"
          :step="EBV_STEP"
          :disabled="!props.modelValue.show"
          color="var(--primary-interactive)"
          density="compact"
          hide-details
          @update:model-value="setField('ebv', $event)"
        />
      </div>
      <div class="slider-block">
        <div class="slider-head">
          <span>log age: {{ props.modelValue.log_age.toFixed(2) }}</span>
          <span class="derived">{{ ageText }}</span>
        </div>
        <v-slider
          :model-value="logAgeIndex"
          :min="0"
          :max="props.logAgeNodes.length - 1"
          :step="1"
          :disabled="!props.modelValue.show"
          color="var(--primary-interactive)"
          density="compact"
          hide-details
          @update:model-value="setField('log_age', props.logAgeNodes[$event])"
        />
      </div>
      <div class="slider-block">
        <div class="slider-head">
          <span>metallicity [Fe/H]: {{ props.modelValue.feh.toFixed(2) }}</span>
        </div>
        <v-slider
          :model-value="fehIndex"
          :min="0"
          :max="props.fehNodes.length - 1"
          :step="1"
          :disabled="!props.modelValue.show"
          color="var(--primary-interactive)"
          density="compact"
          hide-details
          @update:model-value="setField('feh', props.fehNodes[$event])"
        />
      </div>
    </div>
  </v-sheet>
</template>

<style scoped>
.isochrone-controls {
  color: var(--text);
  width: min(100%, 1120px);
  align-self: center;
}
.controls-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.controls-title {
  font-weight: 600;
  letter-spacing: 0.05rem;
  font-size: 0.9rem;
}
.show-switch {
  flex: 0 0 auto;
}
.sliders {
  display: flex;
  flex-wrap: wrap;
  column-gap: 2rem;
  row-gap: 0.5rem;
}
.slider-block {
  flex: 1 1 18rem;
  min-width: 16rem;
}
.slider-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}
.derived {
  color: var(--info);
}
</style>
