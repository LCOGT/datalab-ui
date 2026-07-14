<script setup>
import Chart from 'chart.js/auto'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'
import { getThemeColors, DIMMED_COLOR } from '@/utils/analysisCharts.js'
import { useHistogramWindowSelect } from '@/utils/histogramWindowSelect.js'

/*
  Histogram of the Gaia Bailer-Jones geometric distances of the matched stars - a
  distance-space companion to ParallaxHistogram. Two things differ from the parallax
  version, both because distances behave differently from parallaxes:

  1. Bins are spaced in log10(distance), not linearly. Bailer-Jones distances span a
     huge dynamic range (a cluster piled up near its distance, field stars scattered
     out to tens of kpc); linear bins would collapse the whole cluster into one bar.
     Distances are always positive, so the log is always defined.

  2. The measurement error is folded in. Each star's distance posterior is asymmetric
     (distance_lo / distance_hi are its 16th / 84th percentiles), so instead of dropping
     the star into a single bin by its point estimate, we spread its unit weight across
     bins as a split-normal in log-distance (sigma below = log(d) - log(d_lo), sigma
     above = log(d_hi) - log(d)). Summed over stars this is the "uncertainty-weighted"
     overlay curve: tightly-measured stars stay sharp, poorly-measured far stars melt
     into a low broad bump instead of faking a crisp peak. The bars stay as familiar
     integer counts of the point estimates; the curve is the error-aware view.

  Bars inside the [distance_min, distance_max] window keep the primary color, the rest are
  dimmed. The window is selected with two vertical lines (useHistogramWindowSelect): with no
  window yet, drag across the plot to draw one out; once it exists, drag either dashed line to
  adjust it (both bound through v-model:distance-min / distance-max).
*/

const props = defineProps({
  cmd: {
    type: Array,
    required: true
  },
  distanceMin: {
    type: Number,
    default: null
  },
  distanceMax: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:distanceMin', 'update:distanceMax'])

const distanceCanvas = ref(null)
let distanceChart = null
let themeColors = {}

const BIN_COUNT = 30
// keep a split-normal side from collapsing to a spike when a bound equals the estimate
const MIN_LOG_SIGMA = 1e-3

// Abramowitz & Stegun 7.1.26 error function (max error ~1.5e-7), for the split-normal CDF
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x < 0 ? -y : y
}

// CDF of a split-normal (two half-Gaussians joined at `mode` with different sigmas),
// normalized to total mass 1 - the left half holds sigmaLo/(sigmaLo+sigmaHi) of it. Used
// to integrate a star's distance posterior exactly over each bin
function splitNormalCdf(value, mode, sigmaLo, sigmaHi) {
  const leftFraction = sigmaLo / (sigmaLo + sigmaHi)
  if (value < mode) {
    return leftFraction * (1 + erf((value - mode) / (sigmaLo * Math.SQRT2)))
  }
  return leftFraction + (sigmaHi / (sigmaLo + sigmaHi)) * erf((value - mode) / (sigmaHi * Math.SQRT2))
}

// stars with a Bailer-Jones distance (always positive); the point estimate feeds the
// count bars, the lo/hi bounds feed the uncertainty-weighted curve
const distanceStars = computed(() => {
  return props.cmd.filter((star) => Number.isFinite(star.distance) && star.distance > 0)
})

const histogram = computed(() => {
  const stars = distanceStars.value
  if (!stars.length) return { centers: [], counts: [], smear: [], logMin: 0, logStep: 0 }

  const logs = stars.map((star) => Math.log10(star.distance))
  let logMin = Math.min(...logs)
  let logMax = Math.max(...logs)
  if (logMin === logMax) {
    // a single distinct distance still needs a nonzero (log) bin width
    logMin -= 0.1
    logMax += 0.1
  }
  const logStep = (logMax - logMin) / BIN_COUNT

  const counts = new Array(BIN_COUNT).fill(0)
  for (const log of logs) {
    const bin = Math.min(Math.floor((log - logMin) / logStep), BIN_COUNT - 1)
    counts[bin] += 1
  }

  // error-aware curve: each star's asymmetric distance posterior spread across the bins.
  // It is modeled as a split-normal in log-distance (distance_lo / distance_hi are its
  // 1-sigma-like bounds) and integrated exactly over each bin through its CDF, so every
  // star contributes ~1 total however sharp or broad; the sum is the weighted density
  const smear = new Array(BIN_COUNT).fill(0)
  for (const star of stars) {
    const logMed = Math.log10(star.distance)
    if (!Number.isFinite(star.distance_lo) || !Number.isFinite(star.distance_hi)
        || star.distance_lo <= 0 || star.distance_hi <= 0) {
      // no usable bounds: the star is a delta at its point estimate
      const bin = Math.min(Math.floor((logMed - logMin) / logStep), BIN_COUNT - 1)
      smear[bin] += 1
      continue
    }
    const sigmaLo = Math.max(logMed - Math.log10(star.distance_lo), MIN_LOG_SIGMA)
    const sigmaHi = Math.max(Math.log10(star.distance_hi) - logMed, MIN_LOG_SIGMA)
    let cdfLow = splitNormalCdf(logMin, logMed, sigmaLo, sigmaHi)
    for (let bin = 0; bin < BIN_COUNT; bin++) {
      const cdfHigh = splitNormalCdf(logMin + (bin + 1) * logStep, logMed, sigmaLo, sigmaHi)
      smear[bin] += cdfHigh - cdfLow
      cdfLow = cdfHigh
    }
  }

  const centers = counts.map((_, index) => Math.pow(10, logMin + (index + 0.5) * logStep))
  return { centers: centers, counts: counts, smear: smear, logMin: logMin, logStep: logStep }
})

// pc edges of bin index (log-spaced), used for dimming and tooltips
function binEdges(index) {
  const { logMin, logStep } = histogram.value
  return [Math.pow(10, logMin + index * logStep), Math.pow(10, logMin + (index + 1) * logStep)]
}

// value <-> pixel on the category axis: the bins are uniform in log-distance, so a distance
// maps through its log (bin i is centered at (i + 0.5) / N of the width). These take the chart
// as an argument because the window plugin can fire during the Chart constructor's first draw,
// before the component's chart variable is assigned
function valueToPixel(chart, value) {
  const { centers, logMin, logStep } = histogram.value
  const area = chart.chartArea
  const fraction = (Math.log10(value) - logMin) / (logStep * centers.length)
  return area.left + fraction * (area.right - area.left)
}

function pixelToValue(chart, pixel) {
  const { centers, logMin, logStep } = histogram.value
  const area = chart.chartArea
  const fraction = (pixel - area.left) / (area.right - area.left)
  return Math.pow(10, logMin + fraction * logStep * centers.length)
}

// the draggable two-line min/max window (plugin + pointer handlers), shared with ParallaxHistogram
const { windowActive, plugin: windowPlugin, attach: attachWindow, detach: detachWindow } = useHistogramWindowSelect({
  chart: () => distanceChart,
  min: () => props.distanceMin,
  max: () => props.distanceMax,
  emitMin: (value) => emit('update:distanceMin', value),
  emitMax: (value) => emit('update:distanceMax', value),
  valueToPixel,
  pixelToValue,
  extent: () => {
    const { centers, logMin, logStep } = histogram.value
    return centers.length ? { min: Math.pow(10, logMin), max: Math.pow(10, logMin + logStep * centers.length) } : null
  },
  round: Math.round,
  lineColor: () => themeColors.secondary
})

// bars whose bin overlaps the selection window stay primary, the rest are dimmed
const barColors = computed(() => {
  const { counts } = histogram.value
  return counts.map((_, index) => {
    if (!windowActive()) return themeColors.primary
    const [lower, upper] = binEdges(index)
    const inWindow = upper >= props.distanceMin && lower <= props.distanceMax
    return inWindow ? themeColors.primary : DIMMED_COLOR
  })
})

function formatPc(value) {
  if (value >= 10000) return `${Math.round(value / 1000)}k`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value)}`
}

function tooltipLines(context) {
  if (context.dataset.type === 'line') {
    return `≈ ${context.parsed.y.toFixed(1)} stars (uncertainty-weighted)`
  }
  const [lower, upper] = binEdges(context.dataIndex)
  return [`${context.parsed.y} stars`, `distance ${formatPc(lower)}-${formatPc(upper)} pc`]
}

function buildDatasets() {
  const { counts, smear } = histogram.value
  return [
    {
      type: 'bar',
      label: 'stars',
      data: counts,
      backgroundColor: barColors.value,
      hoverBackgroundColor: themeColors.secondary,
      barPercentage: 0.95,
      categoryPercentage: 1.0,
      order: 2
    },
    {
      type: 'line',
      label: 'uncertainty-weighted',
      data: smear,
      borderColor: themeColors.secondary,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 0,
      tension: 0.3,
      // lower order is drawn last in chart.js, keeping the curve on top of the bars
      order: 1
    }
  ]
}

function updateChart() {
  const { centers, counts, smear } = histogram.value
  distanceChart.data.labels = centers.map((center) => formatPc(center))
  distanceChart.data.datasets[0].data = counts
  distanceChart.data.datasets[0].backgroundColor = barColors.value
  distanceChart.data.datasets[1].data = smear
  distanceChart.update()
}

function createChart() {
  themeColors = getThemeColors()

  const { centers } = histogram.value

  distanceChart = new Chart(distanceCanvas.value, {
    type: 'bar',
    data: {
      labels: centers.map((center) => formatPc(center)),
      datasets: buildDatasets()
    },
    plugins: [windowPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          title: { display: true, text: 'distance (pc, log scale)', color: themeColors.text },
          border: { color: themeColors.text, width: 2 },
          ticks: { color: themeColors.text, maxTicksLimit: 11 },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'stars', color: themeColors.text },
          border: { color: themeColors.text, width: 2 },
          ticks: { color: themeColors.text, precision: 0 },
          grid: { color: themeColors.background, tickColor: themeColors.text }
        }
      },
      plugins: {
        legend: { display: true, labels: { color: themeColors.text, usePointStyle: true } },
        tooltip: { callbacks: { label: tooltipLines } }
      }
    }
  })
}

watch(() => [props.cmd, props.distanceMin, props.distanceMax], () => {
  if (distanceChart) {
    updateChart()
  }
}, { deep: true })

onMounted(() => {
  createChart()
  attachWindow()
})

onBeforeUnmount(() => {
  detachWindow()
})

</script>
<template>
  <div class="wrapper">
    <p class="title-distance">
      Distances
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(distanceChart, 'distances.png', 'Distances')"
      />
    </p>
    <div class="distance-plot-wrapper">
      <canvas
        ref="distanceCanvas"
        class="distance-plot"
      />
    </div>
    <p class="drag-hint">
      {{ windowActive()
        ? 'Drag the dashed lines to adjust the distance window'
        : 'Drag across the plot to select a distance window' }}
    </p>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.title-distance {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1rem;
}
.distance-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}
.distance-plot {
  width: 100% !important;
  height: 100% !important;
  touch-action: none;
}
.drag-hint {
  align-self: center;
  font-size: 0.75rem;
  color: var(--info);
  margin: 0.25rem 0 0;
}
.download-btn {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}
</style>
