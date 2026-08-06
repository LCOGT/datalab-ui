<script setup>
import { computed, ref, watch } from 'vue'
import DistanceHistogram from '@/components/Analysis/DistanceHistogram.vue'
import HRDiagramPlot from '@/components/Analysis/HRDiagramPlot.vue'
import IsochroneControls from '@/components/Analysis/IsochroneControls.vue'
import ProperMotionPlot from '@/components/Analysis/ProperMotionPlot.vue'
import { loadIsochroneGrid, findIsochrone, placeIsochrone, nearestNode, distanceModulusFromParallax, distanceModulusFromParsecs, snapDistanceModulus } from '@/utils/isochrones.js'

/*
  The whole view of an HR diagram (color-magnitude diagram) operation output, split over one
  tab per step of the workflow:
  
  Tab1: filter by proper motion
  Tab2: filter by distance histogram
  Tab3: match an isochrone to the filtered cluster stars
  
  Each tab contains plots + fields/controls.
  This parent component owns the membership selection, the member flags every plot colors by,
  and the isochrone fit.
*/

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const activeTab = ref('proper-motion')

// both filter tabs plot Gaia catalog quantities, so they have nothing to show without a match
const hasGaia = computed(() => ((props.data.n_gaia_matched || 0) + (props.data.n_gaia_only || 0)) > 0)

/*
  Cluster membership selection: the single source of truth for the pm center/radius and the
  distance window, edited by the filter tabs and rendered by all the plots. Initialized from
  the backend's membership_guess when present.
*/
const emptyMembership = {
  pmra: null, pmdec: null, pm_radius: null,
  parallax_min: null, parallax_max: null,
  distance_min: null, distance_max: null
}
const membership = ref({ ...emptyMembership })

/*
  Every cut is independent and optional: filtering runs as soon as any one of them is set, and
  a star has to pass each cut that is set.
*/
const pmCutActive = computed(() =>
  ['pmra', 'pmdec', 'pm_radius'].every((field) => Number.isFinite(membership.value[field]))
)
const distanceCutActive = computed(() =>
  Number.isFinite(membership.value.distance_min) && Number.isFinite(membership.value.distance_max)
)
// Parallax is currently not shown, but remains here if we want to add it later
const parallaxCutActive = computed(() =>
  Number.isFinite(membership.value.parallax_min) && Number.isFinite(membership.value.parallax_max)
)

const membershipActive = computed(() => pmCutActive.value || distanceCutActive.value || parallaxCutActive.value)

// per-star member flags aligned with data.cmd, or null when no selection is active
const memberFlags = computed(() => {
  if (!membershipActive.value) {
    return null
  }
  const selection = membership.value
  // a cut can only keep stars that carry the quantity it tests, so each one requires its own
  // Gaia value to be present: an unmatched star is a non-member of any active cut
  return props.data.cmd.map((star) => {
    if (pmCutActive.value && !(star.gaia_match && Number.isFinite(star.pmra) && Number.isFinite(star.pmdec)
        && Math.hypot(star.pmra - selection.pmra, star.pmdec - selection.pmdec) <= selection.pm_radius)) {
      return false
    }
    if (parallaxCutActive.value && !(Number.isFinite(star.parallax)
        && star.parallax >= selection.parallax_min && star.parallax <= selection.parallax_max)) {
      return false
    }
    if (distanceCutActive.value && !(Number.isFinite(star.distance)
        && star.distance >= selection.distance_min && star.distance <= selection.distance_max)) {
      return false
    }
    return true
  })
})

// Total number of stars in the selection based on current membership values
const memberCount = computed(() => memberFlags.value ? memberFlags.value.filter(Boolean).length : null)

const memberCountText = computed(() => {
  const total = props.data.cmd.length
  return memberCount.value === null
    ? `${total} / ${total} members`
    : `${memberCount.value} / ${total} members`
})

/*
  Isochrone fitting: the grid asset loads lazily on the first output, the fit parameters live
  here, and the placed polyline is handed to the CMD plot. IsochroneControls edits the fit
  object through v-model.
*/
const isochroneGrid = ref(null)
const isochroneLoadFailed = ref(false)
const isochroneFit = ref(null)
// Keep track of if the distance modulus has been set manually yet or not. Until it is set
// manually, we will update it automatically when changing the distance filter range.
const muManuallySet = ref(false)

// Load the isochrone look up table from the local file and perform the initial fit.
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
  return {
    show: true,
    mu: muFromParallax === null ? 10 : snapDistanceModulus(muFromParallax),
    ebv: 0,
    log_age: nearestNode(grid.log_age_nodes, 9.0),
    feh: nearestNode(grid.feh_nodes, 0.0)
  }
}

// placed whenever a fit exists - fit.show only controls drawing, so the plot's
// legend keeps its Isochrone chip while the line is toggled off
const isochronePoints = computed(() => {
  const fit = isochroneFit.value
  if (!isochroneGrid.value || !fit) {
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

/*
  When IsochroneControls updates the fit, if the distance modulus was set then we keep
  track of that to stop us from automatically changing it after
*/
function updateIsochroneFit(fit) {
  if (isochroneFit.value && fit.mu !== isochroneFit.value.mu) {
    muManuallySet.value = true
  }
  isochroneFit.value = fit
}

/*
  If the distance modulus has not been manually set, then when the distance filter ranges are changed
  we automatically update the distance modulus to be the midpoint of the range and update the isochrone.
*/
function setDistanceBound(field, value) {
  membership.value[field] = value
  const { distance_min: min, distance_max: max } = membership.value
  if (muManuallySet.value || !isochroneFit.value) {
    return
  }
  // a half-drawn or cleared window has no midpoint; leave the line where it is
  const mu = Number.isFinite(min) && Number.isFinite(max) ? distanceModulusFromParsecs((min + max) / 2) : null
  if (mu !== null) {
    isochroneFit.value.mu = snapDistanceModulus(mu)
  }
}

watch(() => props.data, () => {
  // a new output starts on the first filter step, unless there's no Gaia data to filter with
  activeTab.value = hasGaia.value ? 'proper-motion' : 'isochrone'
  // seed the selection from the guess, but leave parallax blank for now since we arent using it.
  membership.value = {
    ...emptyMembership,
    ...(props.data.membership_guess || {}),
    parallax_min: null,
    parallax_max: null
  }
  // re-derive the starting fit for the new output once the grid is available
  isochroneFit.value = isochroneGrid.value ? initialIsochroneFit(isochroneGrid.value) : null
  muManuallySet.value = false
  ensureIsochrones()
},
{ immediate: true }
)
</script>
<template>
  <div class="hr-diagram-output">
    <div
      v-if="hasGaia"
      class="tab-bar"
    >
      <v-tabs
        v-model="activeTab"
        class="tabs mb-0"
        grow
      >
        <v-tab
          value="proper-motion"
          prepend-icon="mdi-arrow-all"
        >
          Proper Motion Filter
        </v-tab>
        <v-tab
          value="distance"
          prepend-icon="mdi-map-marker-distance"
        >
          Distance Filter
        </v-tab>
        <v-tab
          value="isochrone"
          prepend-icon="mdi-chart-scatter-plot"
        >
          Isochrone Matching
        </v-tab>
      </v-tabs>
      <span class="member-count">{{ memberCountText }}</span>
    </div>
    <v-tabs-window
      v-model="activeTab"
      class="tabs-window"
    >
      <v-tabs-window-item
        v-if="hasGaia"
        value="proper-motion"
        class="tab-panel"
      >
        <proper-motion-plot
          v-model:selection="membership"
          :cmd="props.data.cmd"
          :member-flags="memberFlags"
          :membership-guess="props.data.membership_guess"
          :cluster-name="props.data.cluster?.name"
          :active="activeTab === 'proper-motion'"
          class="tab-plot"
        />
      </v-tabs-window-item>
      <v-tabs-window-item
        v-if="hasGaia"
        value="distance"
        class="tab-panel"
      >
        <distance-histogram
          :distance-min="membership.distance_min"
          :distance-max="membership.distance_max"
          :cmd="props.data.cmd"
          :membership-guess="props.data.membership_guess"
          :cluster-name="props.data.cluster?.name"
          class="tab-plot"
          @update:distance-min="setDistanceBound('distance_min', $event)"
          @update:distance-max="setDistanceBound('distance_max', $event)"
        />
      </v-tabs-window-item>
      <v-tabs-window-item
        value="isochrone"
        class="tab-panel"
      >
        <h-r-diagram-plot
          :cmd-data="props.data"
          :member-flags="memberFlags"
          :isochrone="isochronePoints"
          :isochrone-visible="!!isochroneFit && isochroneFit.show"
          :active="activeTab === 'isochrone'"
          class="tab-plot"
          @update:isochrone-visible="setIsochroneShown"
        />
        <isochrone-controls
          v-if="isochroneGrid && isochroneFit"
          :model-value="isochroneFit"
          :log-age-nodes="isochroneGrid.log_age_nodes"
          :feh-nodes="isochroneGrid.feh_nodes"
          class="tab-controls"
          @update:model-value="updateIsochroneFit"
        />
        <v-alert
          v-else-if="isochroneLoadFailed"
          type="warning"
          density="compact"
          variant="tonal"
          class="isochrone-alert"
          text="Isochrone models failed to load. Close and reopen the analysis view to retry."
        />
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>

<style scoped>
/* the tab bar keeps its height and the panels take the rest, so a tab fills the screen
   instead of scrolling: plot flexes, controls sit at their natural height underneath */
.hr-diagram-output {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tab-bar {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding-right: 1rem;
  color: var(--text);
  background-color: var(--header);
  border-bottom: 0.1rem solid var(--primary-interactive);
}
.tabs {
  flex: 1 1 20rem;
  min-width: 0;
}
/* highlighting the selected tab off its own class, rather than with v-tabs' color prop */
.tabs :deep(.v-tab--selected) {
  color: var(--primary-interactive);
}
.member-count {
  flex: 0 0 auto;
  font-size: 0.9rem;
}
.tabs-window {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* vuetify's window container is a flex column already; this lets it stretch to the
   window's height so the active panel can flex instead of sizing to its content */
.tabs-window :deep(.v-window__container) {
  flex: 1;
  min-height: 0;
}
.tab-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.5rem;
}
/* scoped through the panel so this outranks each plot component's own .wrapper rule,
   which sets the same properties at the same specificity */
.tab-panel > .tab-plot {
  flex: 1;
  /* a short viewport scrolls the panel rather than squashing the plot away */
  min-height: 320px;
  width: 100%;
  max-width: 1120px;
}
/* the plot holds its min-height, so without this every pixel a short panel is short by
   would come out of the sliders */
.tab-panel > .tab-controls {
  flex: 0 0 auto;
}
.isochrone-alert {
  flex: 0 0 auto;
  width: min(100%, 1120px);
}
</style>
