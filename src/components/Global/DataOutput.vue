<script setup>
import { computed, ref } from 'vue'
import FilterBadge from './FilterBadge.vue'
import { diagnosticsViewFor } from '@/components/Global/diagnostics'
import { lightCurveMagnitudes } from '@/utils/lightCurve.js'

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
    return lightCurveMagnitudes(props.operationOutput.light_curve)
  }
  return []
})

const diagnosticsDialog = ref(false)

// The diagnostics dialog is a generic shell; its body comes from whichever component the
// operation that produced this output registered in components/Global/diagnostics.
const diagnosticsView = computed(() => diagnosticsViewFor(props.operationOutput))

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
  else if (props.operationOutput?.cluster?.name) {
    text = props.operationOutput.cluster.name
  }
  else {
    text = props.operationOutput?.operationName
  }
  return text
})

const emit = defineEmits(['selectOperationOutput', 'launchAnalysis', 'removeOperationOutput', 'removeImage'])

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
    <v-card
      density="compact"
      class="output-card"
    >
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
        <div
          v-if="props.operationOutput.cmd"
          class="cmd-card-summary d-flex flex-column align-center"
        >
          <v-icon
            icon="mdi-chart-scatter-plot"
            size="42"
          />
          <p>{{ props.operationOutput.n_stars }} stars</p>
          <span class="d-flex ga-1 mt-1">
            <filter-badge
              v-if="props.operationOutput.blue_filter"
              :filter="props.operationOutput.blue_filter"
            />
            <filter-badge
              v-if="props.operationOutput.red_filter"
              :filter="props.operationOutput.red_filter"
            />
          </span>
        </div>
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
        v-if="diagnosticsView"
        icon="mdi-information-outline"
        color="var(--info)"
        title="View diagnostics"
        @click.stop="diagnosticsDialog = true"
      />
      <v-icon
        icon="mdi-eye"
        color="var(--primary-interactive)"
        @click.stop="emit('launchAnalysis', props.operationOutput)"
      />
    </div>
    <v-dialog
      v-if="diagnosticsView"
      v-model="diagnosticsDialog"
      max-width="1200"
    >
      <v-card color="var(--card-background)">
        <v-card-title class="diagnostics-title">
          {{ props.operationOutput.operationName }} Diagnostics
        </v-card-title>
        <v-card-text>
          <component
            :is="diagnosticsView"
            :operation-output="props.operationOutput"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text="Close"
            color="var(--primary-interactive)"
            @click="diagnosticsDialog = false"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-sheet>
  <v-skeleton-loader
    v-else
    type="card"
    color="var(--secondary-background)"
    bg-color="var(--primary-background)"
  />
</template>

<style scoped>
.output-card {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.output-card :deep(.v-card-text) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.output-title {
  padding: 0 0 0 0;
  display: flex;
}

.output-title-text {
  align-content: center;
}

.diagnostics-title {
  color: var(--text);
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
