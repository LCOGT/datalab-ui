<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'
import { useAnalysisStore } from '@/stores/analysis'

const emit = defineEmits(['periodSelected'])

const analysisStore = useAnalysisStore()
const canvasEl = ref(null)
let chart = null

// Build an array of {x,y} points from store (x = frequency, y = power)
function getXYPoints() {
  const freqs = (analysisStore.periodogram?.frequencies) || []
  const power = (analysisStore.periodogram?.power) || []
  const points = []
  for (let i = 0; i < freqs.length; i++) {
    points.push({ x: Number(freqs[i]), y: Number(power[i]) })
  }
  return points
}

// Build dataset for selected point marker
function selectedPointDataset(freq, pow) {
  return [{ x: Number(freq), y: Number(pow) }]
}

function createChart() {
  const style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')

  const points = getXYPoints()
  if (!points.length) {
    chart = new Chart(canvasEl.value, {
      type: 'line',
      data: { datasets: [] },
      options: {}
    })
    return
  }

  chart = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Power',
          data: points,
          borderColor: primary,
          borderWidth: 2,
          backgroundColor: primary,
          fill: false,
          pointRadius: 0,
          showLine: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.5,
          parsing: false
        },
        {
          label: 'Selected',
          data: [],
          type: 'scatter',
          pointBackgroundColor: secondary,
          pointBorderColor: secondary,
          pointRadius: 3,
          showLine: false,
          parsing: false
        }
      ]
    },
    options: {
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Frequency', color: text },
          ticks: { color: text },
          grid: { color: background }
        },
        y: {
          title: { display: true, text: 'Power', color: text },
          ticks: { color: text },
          grid: { color: background }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              console.log('tooltip ctx:', ctx)
              const freq = ctx.parsed?.x
              const per = (1 / freq).toFixed(6)
              return `Power: ${ctx.parsed?.y?.toFixed(6)}  |  Period: ${per} d`
            }
          }
        }
      },

      onClick: (evt) => {

        const elements = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true)
        if (elements && elements.length > 0) {
          // user clicked on the line/point directly
          const el = elements[0]
          const dsIdx = el.datasetIndex
          const ptIdx = el.index
          const point = chart.data.datasets[dsIdx].data[ptIdx]
          if (point && point.x && point.y !== undefined) {
            handlePointClick(point.x, point.y)
            return
          }
        }

        // If not clicking exactly on a point, use nearest-x via pixel->value conversion
        const xScale = chart.scales['x']
        const rect = chart.canvas.getBoundingClientRect()
        const xPixel = evt.clientX - rect.left
        const freqFromPixel = xScale.getValueForPixel(xPixel)

        // find nearest datapoint index by absolute difference in x (frequency)
        const pts = chart.data.datasets[0].data
        if (!pts || pts.length === 0) return
        let nearestIdx = 0
        let minDelta = Math.abs(pts[0].x - freqFromPixel)
        for (let i = 1; i < pts.length; i++) {
          const d = Math.abs(pts[i].x - freqFromPixel)
          if (d < minDelta) { minDelta = d; nearestIdx = i }
        }
        const nearestPoint = pts[nearestIdx]
        // only treat as click-on-line if reasonably close in frequency space
        // you can tweak this tolerance (in frequency units)
        const TOLERANCE = (chart.scales['x'].max - chart.scales['x'].min) * 0.02 // 2% of x-range
        if (Math.abs(nearestPoint.x - freqFromPixel) <= TOLERANCE) {
          handlePointClick(nearestPoint.x, nearestPoint.y)
        }
      }
    }
  })
}

function updateChart() {
  console.log('updateChart called, chart:', chart)

  // Build the new points (may be empty array)
  const points = getXYPoints()

  // If chart was not created yet, create it
  if (!chart) {
    createChart()
    return
  }

  // Defensive: if datasets are missing or malformed, recreate the chart
  if (!chart.data || !Array.isArray(chart.data.datasets) || chart.data.datasets.length < 1) {
    try { chart.destroy() } catch (e) { /* ignore */ }
    createChart()
    return
  }

  // Now safely update the primary dataset (dataset[0]) and leave selected marker (dataset[1]) intact
  chart.data.datasets[0].data = points

  // Optional: update y-axis min/max based on points (guard empty)
  const yVals = points.map(p => Number(p.y)).filter(v => Number.isFinite(v))
  if (yVals.length) {
    const minY = Math.min(...yVals)
    const maxY = Math.max(...yVals)
    if (!chart.options.scales) chart.options.scales = {}
    if (!chart.options.scales.y) chart.options.scales.y = {}
    chart.options.scales.y.min = minY
    chart.options.scales.y.max = maxY
  }

  chart.update()
}


function handlePointClick(freq, pow) {
  // Set the selected marker dataset to the clicked point (replace previous)
  chart.data.datasets[1].data = selectedPointDataset(freq, pow)
  chart.update()

  // Compute period and fold via store
  if (!freq || Number.isNaN(freq) || freq <= 0) return
  const period = 1.0 / freq

  if (typeof analysisStore.applySelectedPeriod === 'function') {
    analysisStore.applySelectedPeriod(period)
  } else {
    // fallback: set period on store and attempt to fold manually
    analysisStore.variableStarData.period = period
    // If you haven't added applySelectedPeriod, your phased plot may not update; add applySelectedPeriod to the store.
  }

  // tell parent to switch to phased light curve (parent will set the dropdown)
  emit('periodSelected', period)
}

// react to store changes
watch(
  () => analysisStore.periodogram,
  () => updateChart(),
  { deep: true }
)

onMounted(() => createChart())
onUnmounted(() => { if (chart) { chart.destroy(); chart = null } })
</script>

<template>
  <canvas
    ref="canvasEl"
    class="periodogram-plot"
  />
</template>

<style scoped>
.periodogram-plot { width: 100%; height: 320px; }
</style>
