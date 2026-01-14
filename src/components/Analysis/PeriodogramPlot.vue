<script setup>
import { ref, watch, onMounted, defineProps, defineEmits } from 'vue'
import Chart from 'chart.js/auto'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'

const emit = defineEmits(['periodSelected'])

const props = defineProps({
  periodogramData: {
    type: Object,
    required: true,
  },
  variableStarData: {
    type: Object,
    required: true,
  }
})

const canvasEl = ref(null)
let chart = null

// Build an array of {x,y} points from store (x = frequency, y = power)
function getXYPoints() {
  const freqs = (props.periodogramData.frequencies) || []
  const power = (props.periodogramData.power) || []
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
  let selected = []
  if (
    props.periodogramData.peakIndex != null &&
    points[props.periodogramData.peakIndex]
  ) {
    selected = [points[props.periodogramData.peakIndex]]
  }
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
          parsing: false,
          order: 1
        },
        {
          label: 'Selected',
          data: selected,
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
              const freq = ctx.parsed?.x
              const per = (1 / freq).toFixed(6)
              return `Power: ${ctx.parsed?.y?.toFixed(6)}  |  Period: ${per} d`
            }
          }
        }
      },

      onClick: (evt) => {

        const elements = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true)
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
      }
    }
  })
}

function updateChart() {
  const points = getXYPoints()
  // If chart was not created yet, create it
  if (!chart) {
    createChart()
    return
  }

  if (!chart.data || !chart.data.datasets || chart.data.datasets.length < 1) {
    try { chart.destroy() } catch (e) { /* ignore */ }
    createChart()
    return
  }

  // Now safely update the primary dataset (dataset[0]) and leave selected marker (dataset[1]) intact
  chart.data.datasets[0].data = points

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
  // Sets selected point marker or replaces it
  chart.data.datasets[1].data = selectedPointDataset(freq, pow)
  chart.update()

  if (!freq || Number.isNaN(freq) || freq <= 0) return
  const period = 1.0 / freq
  emit('periodSelected', period)
}

watch(
  () => props.periodogramData,
  () => updateChart(),
  { deep: true }
)

onMounted(() => {
  createChart()
})
</script>

<template>
  <div class="wrapper">
    <h1 class="title-pd">
      Periodogram
    </h1>
    <div class="periodogram-plot-wrapper">
      <canvas
        ref="canvasEl"
        class="periodogram-plot"
      />
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(chart, 'periodogram-plot.png', 'Periodogram')"
      />
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
}
.title-pd {
  align-self: center;
}
.periodogram-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;
  width: 100%;
}
.periodogram-plot {
  height: 100% !important;
}
.download-btn {
  margin-left: 1rem;
  margin-bottom: 1rem;
  align-self: flex-end;
}
</style>
