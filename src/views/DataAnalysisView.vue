<script setup>
import { computed, watch, ref } from 'vue'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import LightCurvePlot from '@/components/Analysis/LightCurvePlot.vue'
import PeriodogramPlot from '@/components/Analysis/PeriodogramPlot.vue'
import PhasedLightCurvePlot from '@/components/Analysis/PhasedLightCurvePlot.vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: null,
  }
})

const emit = defineEmits(['closeAnalysisDialog'])

const periodogramData = ref({})
const variableStarData = ref({})

function foldPeriod(magTimeSeries, period) {
  const frequency = 1.0 / period

  for (let i = 0; i < magTimeSeries.length; i++) {
    const mts = magTimeSeries[i]
    mts.phase = (mts.julian_date % period) * frequency
  }
}

function assignVariableStarData() {
  const data = props.data
  const magnitudeTimeSeries = data.light_curve
  const period = data.period
  const frequency = data.frequency
  const power = data.power

  if (period && magnitudeTimeSeries.length >0) {
    variableStarData.value = {
      targetCoords: data.target_coords,
      magPhasedLightCurve: [],
      period: period,
      falseAlarmProbability: data.fap,
      fluxFallback: data.flux_fallback,
      excludedImages: data.excluded_images,
      magnitudeTimeSeries: magnitudeTimeSeries,
    }
  }

  // Pairing frequency and power data
  if (frequency && power && frequency.length === power.length) {
    const pairs = frequency.map((f, i) => ({ f: Number(f), p: Number(power[i]) }))
    const freqs = pairs.map(x => x.f)
    const pows = pairs.map(x => x.p)
    const periods = freqs.map(f => 1.0 / f)
    let peakIndex = 0
    let peakPower = pows[0] || 0
    // Finding peak power
    for (let i = 1; i < pows.length; i++) {
      if (pows[i] > peakPower) {
        peakPower = pows[i]
        peakIndex = i
      }
    }
    periodogramData.value = {
      frequencies: freqs,
      power: pows,
      periods: periods,
      peakIndex: peakIndex,
      peakFrequency: freqs[peakIndex],
      peakPeriod: periods[peakIndex],
      peakPower: peakPower
    }
  } else {
    periodogramData.value = {
      frequencies: [],
      power: [],
      periods: [],
      peakIndex: null,
      peakFrequency: null,
      peakPeriod: null,
      peakPower: null
    }
  }
  if (periodogramData.value.peakPeriod && variableStarData.value.magnitudeTimeSeries) {
    foldPeriod(variableStarData.value.magnitudeTimeSeries, periodogramData.value.peakPeriod)
    variableStarData.value.period = periodogramData.value.peakPeriod
    variableStarData.value.magPhasedLightCurve = [...variableStarData.value.magnitudeTimeSeries].sort((a, b) => a.phase - b.phase)
  }
}

function applySelectedPeriod(period) {
  foldPeriod(props.data.light_curve, period)
  // store the selected period and update phased LC
  variableStarData.value.period = period
  variableStarData.value.magPhasedLightCurve = [...props.data.light_curve].sort((a, b) => a.phase - b.phase)
}

const handlePeriodSelected = (period) => {
  applySelectedPeriod(period)
}

watch(() => props.data, () => {
  assignVariableStarData()
},
{ immediate: true }
)

const title = computed(() => {
  let text = props.data?.operationName || 'Unknown'
  if (props.data?.source) {
    text += ': ' + props.data.source?.name
  }
  return text
})

</script>
<template>
  <v-sheet class="analysis-page">
    <v-toolbar
      class="analysis-toolbar"
      density="comfortable"
    >
      <filter-badge
        v-if="props.data.filter"
        :filter="props.data.filter"
        class="ml-2"
      />
      <v-toolbar-title :text="title" />
      <v-btn
        icon="mdi-close"
        color="var(--cancel)"
        @click="emit('closeAnalysisDialog')"
      />
    </v-toolbar>
    <template v-if="props.data">
      <div
        class="analysis-content"
      >
        <v-row class="analysis-row">
          <light-curve-plot
            :variable-star-data="variableStarData"
            class="light-curve-plot"
          />
        </v-row>
        <v-row class="analysis-row">
          <periodogram-plot
            :periodogram-data="periodogramData"
            :variable-star-data="variableStarData"
            class="periodogram-plot"
            @period-selected="handlePeriodSelected"
          />
        </v-row>
        <v-row class="analysis-row">
          <phased-light-curve-plot
            :variable-star-data="variableStarData"
            :periodogram-data="periodogramData"
            class="period-plot"
          />
        </v-row>
      </div>
    </template>
  </v-sheet>
</template>
<style scoped>
.analysis-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 1.5vh;
  overflow: hidden;
}
.analysis-page{
  background-color: var(--primary-background);
  color: greenyellow;
  font-family: var(--font-stack);
  height: 100vh;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.analysis-toolbar{
  color: var(--text);
  background-color: var(--header);
}
.analysis-row {
  flex: 0 0 26vh;
  min-height: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.2rem
}

</style>
