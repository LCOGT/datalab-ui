<script setup>
import { computed, watch, ref } from 'vue'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import HRDiagramPlot from '@/components/Analysis/HRDiagramPlot.vue'
import IsochroneControls from '@/components/Analysis/IsochroneControls.vue'
import LightCurvePlot from '@/components/Analysis/LightCurvePlot.vue'
import MembershipControls from '@/components/Analysis/MembershipControls.vue'
import ParallaxHistogram from '@/components/Analysis/ParallaxHistogram.vue'
import DistanceHistogram from '@/components/Analysis/DistanceHistogram.vue'
import PeriodogramPlot from '@/components/Analysis/PeriodogramPlot.vue'
import PhasedLightCurvePlot from '@/components/Analysis/PhasedLightCurvePlot.vue'
import ProperMotionPlot from '@/components/Analysis/ProperMotionPlot.vue'
import { loadIsochroneGrid, findIsochrone, placeIsochrone, nearestNode, distanceModulusFromParallax } from '@/utils/isochrones.js'

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
const bestPeriod = ref(null)
const selectedPoints = ref([])
// each output type has its own detection key, dispatching to the right set of plots
const hasCMD = computed(() => Array.isArray(props.data?.cmd))
const hasLightCurve = computed(() => Array.isArray(props.data?.light_curve) && props.data.light_curve.length > 0)
const hasPeriodogram = computed(() => Array.isArray(periodogramData.value.frequencies) && periodogramData.value.frequencies.length > 0)
const hasGaia = computed(() => hasCMD.value && ((props.data.n_gaia_matched || 0) + (props.data.n_gaia_only || 0)) > 0)

/*
  Cluster membership selection (CMD outputs): the single source of truth for the
  pm center/radius + parallax window, edited by MembershipControls and rendered by
  all three plots. Initialized from the backend's membership_guess when present.
*/
const emptyMembership = {
  pmra: null, pmdec: null, pm_radius: null,
  parallax_min: null, parallax_max: null,
  distance_min: null, distance_max: null
}
const membership = ref({ ...emptyMembership })

// filtering only activates once a proper motion center + radius are set
const membershipActive = computed(() =>
  ['pmra', 'pmdec', 'pm_radius'].every((field) => Number.isFinite(membership.value[field]))
)

// per-star member flags aligned with data.cmd, or null when no selection is active
const memberFlags = computed(() => {
  if (!hasCMD.value || !membershipActive.value) {
    return null
  }
  const selection = membership.value
  // the parallax and distance windows are independent optional cuts; both must pass
  const parallaxWindowActive = Number.isFinite(selection.parallax_min) && Number.isFinite(selection.parallax_max)
  const distanceWindowActive = Number.isFinite(selection.distance_min) && Number.isFinite(selection.distance_max)
  return props.data.cmd.map((star) => {
    if (!star.gaia_match || !Number.isFinite(star.pmra) || !Number.isFinite(star.pmdec)) {
      return false
    }
    if (Math.hypot(star.pmra - selection.pmra, star.pmdec - selection.pmdec) > selection.pm_radius) {
      return false
    }
    if (parallaxWindowActive && !(Number.isFinite(star.parallax)
        && star.parallax >= selection.parallax_min && star.parallax <= selection.parallax_max)) {
      return false
    }
    if (distanceWindowActive && !(Number.isFinite(star.distance)
        && star.distance >= selection.distance_min && star.distance <= selection.distance_max)) {
      return false
    }
    return true
  })
})

const memberCount = computed(() => memberFlags.value ? memberFlags.value.filter(Boolean).length : null)

/*
  Isochrone fitting (CMD outputs): the grid asset loads lazily on the first CMD
  output, the fit parameters live here, and the placed polyline is handed to the
  CMD plot. IsochroneControls edits the fit object through v-model.
*/
const isochroneGrid = ref(null)
const isochroneLoadFailed = ref(false)
const isochroneFit = ref(null)

function ensureIsochrones() {
  isochroneLoadFailed.value = false
  loadIsochroneGrid()
    .then((grid) => {
      isochroneGrid.value = grid
      if (!isochroneFit.value) {
        isochroneFit.value = initialIsochroneFit(grid)
      }
    })
    .catch(() => {
      isochroneLoadFailed.value = true
    })
}

function initialIsochroneFit(grid) {
  // start the distance at the Gaia parallax distance when the backend found a clump,
  // so the model line lands near the cluster sequence instead of far off-plot
  const guess = props.data.membership_guess
  const parallaxCenter = guess ? (guess.parallax_min + guess.parallax_max) / 2 : null
  const muFromParallax = distanceModulusFromParallax(parallaxCenter)
  const mu = muFromParallax === null ? 10 : Math.min(Math.max(muFromParallax, 0), 18)
  return {
    show: true,
    mu: Math.round(mu * 20) / 20,   // keep it on the slider's 0.05 step
    ebv: 0,
    log_age: nearestNode(grid.log_age_nodes, 9.0),
    feh: nearestNode(grid.feh_nodes, 0.0)
  }
}

// placed whenever a fit exists — fit.show only controls drawing, so the plot's
// legend keeps its Isochrone chip while the line is toggled off
const isochronePoints = computed(() => {
  const fit = isochroneFit.value
  if (!hasCMD.value || !isochroneGrid.value || !fit) {
    return null
  }
  const isochrone = findIsochrone(isochroneGrid.value, fit.feh, fit.log_age)
  return isochrone ? placeIsochrone(isochrone, props.data.blue_filter, props.data.red_filter, fit.mu, fit.ebv) : null
})

// the plot's legend chip and IsochroneControls' show-switch share this flag
function setIsochroneShown(shown) {
  if (isochroneFit.value) {
    isochroneFit.value.show = shown
  }
}

function foldPeriod(magTimeSeries, period) {
  const frequency = 1.0 / period

  for (let i = 0; i < magTimeSeries.length; i++) {
    const mts = magTimeSeries[i]
    mts.phase = (mts.julian_date % period) * frequency
  }
}

function assignVariableStarData() {
  const data = props.data
  const magnitudeTimeSeries = data.light_curve || []
  const period = data.period
  const frequency = data.frequency
  const power = data.power

  if (magnitudeTimeSeries.length > 0) {
    variableStarData.value = {
      targetCoords: data.target_coords,
      magPhasedLightCurve: [],
      period: period,
      falseAlarmProbability: data.fap,
      fluxFallback: data.flux_fallback,
      excludedImages: data.excluded_images || [],
      magnitudeTimeSeries: magnitudeTimeSeries,
    }
  } else {
    variableStarData.value = {}
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

const handlePeriodSelected = (period, freq, pow, bestPeriodFromPlot) => {
  applySelectedPeriod(period)
  bestPeriod.value = bestPeriodFromPlot
  selectedPoints.value = [{ x: freq, y: pow }]
}

watch(() => props.data, () => {
  if (hasCMD.value) {
    // seed the pm circle from the guess, but start BOTH histogram windows empty (the user
    // draws them on the plots) so neither the parallax nor the distance histogram is
    // pre-selected. "Use Suggestion" still re-applies the guess's parallax window.
    membership.value = {
      ...emptyMembership,
      ...(props.data.membership_guess || {}),
      parallax_min: null,
      parallax_max: null
    }
    // re-derive the starting fit for the new output once the grid is available
    isochroneFit.value = isochroneGrid.value ? initialIsochroneFit(isochroneGrid.value) : null
    ensureIsochrones()
  }
  else {
    assignVariableStarData()
  }
},
{ immediate: true }
)

const title = computed(() => {
  let text = props.data?.operationName || 'Unknown'
  if (props.data?.source) {
    text += ': ' + props.data.source?.name
  }
  else if (props.data?.cluster?.name) {
    text += ': ' + props.data.cluster.name
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
      <template v-if="hasCMD">
        <filter-badge
          v-if="props.data.blue_filter"
          :filter="props.data.blue_filter"
          class="ml-2"
        />
        <filter-badge
          v-if="props.data.red_filter"
          :filter="props.data.red_filter"
          class="ml-1"
        />
      </template>
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
        <div
          v-if="hasCMD"
          class="analysis-row cmd-analysis-row"
        >
          <h-r-diagram-plot
            :cmd-data="props.data"
            :member-flags="memberFlags"
            :isochrone="isochronePoints"
            :isochrone-visible="!!isochroneFit && isochroneFit.show"
            class="hr-diagram-plot"
            @update:isochrone-visible="setIsochroneShown"
          />
        </div>
        <isochrone-controls
          v-if="hasCMD && isochroneGrid && isochroneFit"
          v-model="isochroneFit"
          :log-age-nodes="isochroneGrid.log_age_nodes"
          :feh-nodes="isochroneGrid.feh_nodes"
        />
        <v-alert
          v-else-if="hasCMD && isochroneLoadFailed"
          type="warning"
          density="compact"
          variant="tonal"
          class="isochrone-alert"
          text="Isochrone models failed to load. Close and reopen the analysis view to retry."
        />
        <membership-controls
          v-if="hasGaia"
          v-model="membership"
          :membership-guess="props.data.membership_guess"
          :member-count="memberCount"
          :total-stars="props.data.cmd.length"
        />
        <div
          v-if="hasGaia"
          class="analysis-row membership-plots-row"
        >
          <proper-motion-plot
            v-model:selection="membership"
            :cmd="props.data.cmd"
            :member-flags="memberFlags"
            class="membership-plot"
          />
          <parallax-histogram
            v-model:parallax-min="membership.parallax_min"
            v-model:parallax-max="membership.parallax_max"
            :cmd="props.data.cmd"
            class="membership-plot"
          />
        </div>
        <div
          v-if="hasGaia"
          class="analysis-row membership-plots-row"
        >
          <distance-histogram
            v-model:distance-min="membership.distance_min"
            v-model:distance-max="membership.distance_max"
            :cmd="props.data.cmd"
            class="membership-plot"
          />
        </div>
        <div
          v-if="hasLightCurve"
          class="analysis-row"
        >
          <light-curve-plot
            :variable-star-data="variableStarData"
            class="light-curve-plot"
          />
        </div>
        <div
          v-if="hasPeriodogram"
          class="analysis-row"
        >
          <periodogram-plot
            :periodogram-data="periodogramData"
            :variable-star-data="variableStarData"
            class="periodogram-plot"
            @period-selected="handlePeriodSelected"
          />
        </div>
        <div
          v-if="hasPeriodogram"
          class="analysis-row phased-analysis-row"
        >
          <phased-light-curve-plot
            :variable-star-data="variableStarData"
            :periodogram-data="periodogramData"
            :best-period="bestPeriod"
            :selected-points="selectedPoints"
            class="period-plot"
          />
        </div>
      </div>
    </template>
  </v-sheet>
</template>
<style scoped>
.analysis-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 2rem clamp(1rem, 4vw, 4rem) 3rem;
  min-height: 0;
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
  flex: 0 0 auto;
  height: clamp(360px, 46vh, 560px);
  width: 100%;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phased-analysis-row {
  height: clamp(420px, 54vh, 640px);
}
.cmd-analysis-row {
  height: clamp(480px, 70vh, 800px);
}
.membership-plots-row {
  gap: 2rem;
  align-items: stretch;
}
.membership-plot {
  flex: 1 1 0;
  min-width: 0;
}
.isochrone-alert {
  width: min(100%, 1120px);
  align-self: center;
  flex: 0 0 auto;
}

</style>
