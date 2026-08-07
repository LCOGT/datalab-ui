<script setup>
import { computed, ref } from 'vue'
import FilterBadge from '@/components/Global/FilterBadge.vue'
import TitledCard from '@/components/Global/TitledCard.vue'

/*
  Diagnostics for an HR Diagram (color-magnitude diagram) operation output: the inputs and
  star counts that produced the CMD, and a table of all the CMD Stars and their properties.
*/

const props = defineProps({
  operationOutput: {
    type: Object,
    default: () => ({})
  }
})

// Options for the origin of each star, which can be in the input images, gaia, or both.
const SOURCE_FILTERS = [
  { title: 'All stars', value: 'all' },
  { title: 'Image + Gaia', value: 'image-gaia' },
  { title: 'Image only', value: 'image' },
  { title: 'Gaia only', value: 'gaia' },
]

const search = ref('')
const sourceFilter = ref('all')

const cluster = computed(() => props.operationOutput?.cluster || {})
const membershipGuess = computed(() => props.operationOutput?.membership_guess || null)

const clusterDetails = computed(() => [
  { label: 'Cluster', value: cluster.value.name || 'Unnamed' },
  { label: 'Center RA', value: formatNumber(cluster.value.ra, 6, '°') },
  { label: 'Center Dec', value: formatNumber(cluster.value.dec, 6, '°') },
  { label: 'Search Radius', value: formatNumber(cluster.value.radius_arcmin, 2, ' arcmin') },
])

const starCounts = computed(() => [
  { label: 'Stars Found', value: props.operationOutput?.n_stars },
  { label: 'Stars Matched', value: props.operationOutput?.n_stars_matched },
  { label: 'Matched to Gaia', value: props.operationOutput?.n_gaia_matched },
  { label: 'Gaia Only', value: props.operationOutput?.n_gaia_only },
])

const membershipDetails = computed(() => {
  const guess = membershipGuess.value
  if (!guess) return []
  return [
    { label: 'pmRA Center', value: formatNumber(guess.pmra, 3, ' mas/yr') },
    { label: 'pmDec Center', value: formatNumber(guess.pmdec, 3, ' mas/yr') },
    { label: 'pm Radius', value: formatNumber(guess.pm_radius, 3, ' mas/yr') },
    { label: 'Parallax Range', value: formatRange(guess.parallax_min, guess.parallax_max, 3, ' mas') },
    { label: 'Distance Range', value: formatRange(guess.distance_min, guess.distance_max, 0, ' pc') },
  ]
})

const blueFilter = computed(() => props.operationOutput?.blue_filter || '')
const redFilter = computed(() => props.operationOutput?.red_filter || '')

const tableHeaders = computed(() => [
  { title: 'Source', key: 'source' },
  { title: 'RA', key: 'ra', align: 'center' },
  { title: 'Dec', key: 'dec', align: 'center' },
  { title: colorTitle.value, key: 'color', align: 'center' },
  { title: magTitle.value, key: 'mag', align: 'center' },
  { title: 'pmRA (mas/yr)', key: 'pmra', align: 'center' },
  { title: 'pmDec (mas/yr)', key: 'pmdec', align: 'center' },
  { title: 'Distance (pc)', key: 'distance', align: 'center' },
  { title: 'Parallax (mas)', key: 'parallax', align: 'center' },
])

const colorTitle = computed(() => {
  return blueFilter.value && redFilter.value ? `Color (${blueFilter.value} - ${redFilter.value})` : 'Color'
})

const magTitle = computed(() => {
  const band = props.operationOutput?.mag_band || redFilter.value
  return band ? `Mag (${band})` : 'Mag'
})

// `source` is materialized onto each row rather than computed in the template so that the
// table can sort, filter, and search on it like any other column
const tableItems = computed(() => {
  return (props.operationOutput?.cmd || []).map(star => ({
    ...star,
    source: sourceLabel(star),
  }))
})

const filteredItems = computed(() => {
  if (sourceFilter.value === 'all') return tableItems.value
  return tableItems.value.filter(star => sourceValue(star) === sourceFilter.value)
})

function sourceValue(star) {
  if (star.gaia_only) return 'gaia'
  return star.gaia_match ? 'image-gaia' : 'image'
}

function sourceLabel(star) {
  return SOURCE_FILTERS.find(filter => filter.value === sourceValue(star))?.title || ''
}

function formatNumber(value, digits = 3, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}${suffix}`
}

// value ± uncertainty, collapsing to just the value when the error is missing
function formatMeasurement(value, error, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  const formattedValue = Number(value).toFixed(digits)
  if (error === null || error === undefined || !Number.isFinite(Number(error))) return formattedValue
  return `${formattedValue} ± ${Number(error).toFixed(digits)}`
}

function formatRange(minimum, maximum, digits = 3, suffix = '') {
  if (minimum === null || minimum === undefined || maximum === null || maximum === undefined) return '—'
  return `${Number(minimum).toFixed(digits)} – ${Number(maximum).toFixed(digits)}${suffix}`
}

// the Bailer-Jones distance carries asymmetric 16th/84th percentile bounds rather than an error
function formatDistance(star) {
  if (star.distance === null || star.distance === undefined) return '—'
  const distance = Number(star.distance).toFixed(0)
  if (star.distance_lo === null || star.distance_lo === undefined ||
    star.distance_hi === null || star.distance_hi === undefined) {
    return distance
  }
  return `${distance} (${Number(star.distance_lo).toFixed(0)} – ${Number(star.distance_hi).toFixed(0)})`
}
</script>
<template>
  <section class="diagnostics-section">
    <titled-card
      title="Cluster"
      title-background="var(--card-background)"
    >
      <div class="summary-grid divided-grid">
        <div
          v-for="detail in clusterDetails"
          :key="detail.label"
          class="summary-item"
        >
          <span class="summary-label">{{ detail.label }}</span>
          <span class="summary-value">{{ detail.value }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Filters</span>
          <span class="summary-value d-flex ga-1">
            <filter-badge
              v-if="blueFilter"
              :filter="blueFilter"
            />
            <filter-badge
              v-if="redFilter"
              :filter="redFilter"
            />
          </span>
        </div>
      </div>
    </titled-card>
  </section>
  <section class="diagnostics-section">
    <titled-card
      title="Stars"
      title-background="var(--card-background)"
    >
      <div class="summary-grid divided-grid">
        <div
          v-for="count in starCounts"
          :key="count.label"
          class="summary-item"
        >
          <span class="summary-label">{{ count.label }}</span>
          <span class="summary-value">{{ count.value ?? '—' }}</span>
        </div>
      </div>
    </titled-card>
  </section>
  <section class="diagnostics-section">
    <titled-card
      title="Membership Guess"
      title-background="var(--card-background)"
    >
      <div
        v-if="membershipDetails.length"
        class="summary-grid divided-grid"
      >
        <div
          v-for="detail in membershipDetails"
          :key="detail.label"
          class="summary-item"
        >
          <span class="summary-label">{{ detail.label }}</span>
          <span class="summary-value">{{ detail.value }}</span>
        </div>
      </div>
      <p
        v-else
        class="summary-empty"
      >
        No membership guess — too few Gaia matches or no clear proper-motion clump, so the
        selection has to be made by hand in the analysis view.
      </p>
    </titled-card>
  </section>
  <section class="diagnostics-section">
    <titled-card
      title="Color-Magnitude Diagram Stars"
      title-background="var(--card-background)"
    >
      <div class="table-controls">
        <v-text-field
          v-model="search"
          variant="solo-filled"
          bg-color="var(--primary-background)"
          prepend-inner-icon="mdi-magnify"
          label="Search stars"
          density="compact"
          hide-details
          single-line
        />
        <v-select
          v-model="sourceFilter"
          :items="SOURCE_FILTERS"
          variant="solo-filled"
          bg-color="var(--primary-background)"
          label="Star source"
          density="compact"
          hide-details
        />
      </div>
      <v-data-table
        v-model:search="search"
        :headers="tableHeaders"
        :items="filteredItems"
        :items-per-page="10"
        :items-per-page-options="[10, 25, 50, 100]"
        class="diagnostics-table"
        multi-sort
        striped="odd"
      >
        <template #[`item.ra`]="{ item }">
          {{ formatNumber(item.ra, 6) }}
        </template>
        <template #[`item.dec`]="{ item }">
          {{ formatNumber(item.dec, 6) }}
        </template>
        <template #[`item.color`]="{ item }">
          {{ formatMeasurement(item.color, item.color_err, 3) }}
        </template>
        <template #[`item.mag`]="{ item }">
          {{ formatMeasurement(item.mag, item.magerr, 3) }}
        </template>
        <template #[`item.g_mag`]="{ item }">
          {{ formatNumber(item.g_mag, 3) }}
        </template>
        <template #[`item.pmra`]="{ item }">
          {{ formatMeasurement(item.pmra, item.pmra_err, 3) }}
        </template>
        <template #[`item.pmdec`]="{ item }">
          {{ formatMeasurement(item.pmdec, item.pmdec_err, 3) }}
        </template>
        <template #[`item.parallax`]="{ item }">
          {{ formatMeasurement(item.parallax, item.parallax_err, 3) }}
        </template>
        <template #[`item.distance`]="{ item }">
          {{ formatDistance(item) }}
        </template>
      </v-data-table>
    </titled-card>
  </section>
</template>

<style scoped>
.diagnostics-section {
  margin-bottom: 1.5rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.5rem;
}

.summary-item {
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
}

.divided-grid .summary-item {
  align-items: center;
  position: relative;
  text-align: center;
}

.divided-grid .summary-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -0.25rem;
  transform: translateY(-50%);
  width: 1px;
  height: 60%;
  background-color: var(--text);
  opacity: 0.25;
}

.summary-label {
  color: var(--text);
  font-size: 0.7rem;
  opacity: 0.7;
  text-transform: uppercase;
}

.summary-value {
  color: var(--text);
  font-family: monospace;
  font-size: 0.9rem;
}

.summary-empty {
  color: var(--text);
  font-size: 0.85rem;
  opacity: 0.8;
}

.table-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.table-controls :deep(.v-select) {
  max-width: 12rem;
}

.diagnostics-table {
  background-color: var(--primary-background);
  border-radius: 8px;
  color: var(--text);
  overflow: hidden;
}

.diagnostics-table :deep(th) {
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.diagnostics-table :deep(td) {
  color: var(--text);
  font-family: monospace;
  font-size: 0.8rem;
  white-space: nowrap;
}

.diagnostics-table :deep(.v-divider) {
  margin: 0;
}
</style>
