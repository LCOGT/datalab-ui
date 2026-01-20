<script setup>
import { computed } from 'vue'
import FilterBadge from './FilterBadge.vue'

const props = defineProps({
  operationOutput: {
    type: Object,
    default: () => {}
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  enableCards: {
    type: Boolean,
    default: true
  },
  enableRemoval: {
    type: Boolean,
    default: false
  }
})

const lightCurveSparkline = computed(() => {
  if (props.operationOutput.light_curve) {
    return props.operationOutput.light_curve.map(({ mag }) => mag)
  }
  return []
})

const periodogramSparkline = computed(() => {
  if (props.operationOutput.power) {
    return props.operationOutput.power
  }
  return []
})

const title = computed (() => {
  let text = ''
  if (props.operationOutput?.source) {
    text = props.operationOutput.source?.name
  }
  else {
    text = props.operationOutput?.operationName
  }
  return text
})

const emit = defineEmits(['selectOperationOutput', 'launchAnalysis', 'removeOperationOutput'])

</script>
<template>
  <v-sheet
    v-if="props.operationOutput"
    class="pa-1 annotated-output"
    color="var(--secondary-background)"
    :elevation="2"
    rounded
    :class="{ 'selected-output': isSelected }"
    @click="emit('selectOperationOutput', props.operationOutput)"
  >
    <v-card density="compact">
      <v-card-title class="output-title">
        <filter-badge
          v-if="props.operationOutput.filter"
          :filter="props.operationOutput.filter"
        />
        <p class="ml-2 output-title-text">
          {{ props.operationOutput.operationName }}
        </p>
      </v-card-title>
      <v-card-text class="p-1">
        <v-sparkline
          v-if="props.operationOutput.light_curve" 
          v-model="lightCurveSparkline"
        />
        <v-sparkline
          v-if="props.operationOutput.power" 
          v-model="periodogramSparkline"
        />
        <p v-if="props.operationOutput.period">
          {{ props.operationOutput.period.toFixed(4) }} days
        </p>
        <span
          v-if="props.enableRemoval"
          class="removal-button-overlay"
        >
          <v-btn
            density="compact"
            icon="mdi-close"
            @click="emit('removeImage', props.image)"
          />
        </span>
      </v-card-text>
    </v-card>
    <div
      v-if="props.enableCards"
      class="d-flex flex-row ga-2 align-center mt-2"
    >
      <p class="text-subtitle-2 mr-auto prevent-select single-line-text">
        {{ title }}
      </p>
      <v-icon
        icon="mdi-eye"
        color="var(--primary-interactive)"
        @click.stop="emit('launchAnalysis', props.operationOutput)"
      />
    </div>
  </v-sheet>
  <v-skeleton-loader
    v-else
    type="card"
    color="var(--secondary-background)"
    bg-color="var(--primary-background)"
  />
</template>

<style scoped>
.output-title {
  padding: 0 0 0 0;
  display: flex;
}

.output-title-text {
  align-content: center;
}

.annotated-output {
  max-width: 200px;
  min-width: 120px;
  width: 100%;
}

.selected-output {
  outline: 0.3rem solid var(--primary-interactive);
}

.removal-button-overlay {
  color: var(--text);
  font-weight: bold;
  right: 5px;
  bottom: 5px;
  position: absolute;
}
</style>
