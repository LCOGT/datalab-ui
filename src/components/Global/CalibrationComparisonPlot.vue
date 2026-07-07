<script setup>
import Chart from 'chart.js/auto'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  target: {
    type: Object,
    default: null
  },
  title: {
    type: String,
    default: 'Calibration Comparison'
  }
})

const canvas = ref(null)
let chart = null

const candidatePoints = computed(() => {
  return props.rows
    .map(row => ({
      x: Number(row.calculatedMagnitude),
      y: Number(row.calculatedFlux),
      candidateId: row.identifier,
    }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
})

const calibrationLinePoints = computed(() => {
  const points = [...candidatePoints.value, ...targetPoints.value]
  const validPoints = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.y > 0)
  if (!validPoints.length) return []

  const targetPoint = targetPoints.value.find(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.y > 0)
  const zeroPointSource = targetPoint || validPoints[0]
  const zeroPoint = zeroPointSource.x + (2.5 * Math.log10(zeroPointSource.y))
  const magnitudes = validPoints.map(point => point.x)
  const minMagnitude = Math.min(...magnitudes)
  const maxMagnitude = Math.max(...magnitudes)

  return [
    { x: minMagnitude, y: magnitudeToCounts(minMagnitude, zeroPoint) },
    { x: maxMagnitude, y: magnitudeToCounts(maxMagnitude, zeroPoint) },
  ]
})

const targetPoints = computed(() => {
  const x = Number(props.target?.magnitude)
  const y = Number(props.target?.flux)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return []
  return [{ x, y }]
})

function createChart() {
  if (!canvas.value) return
  const style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')

  chart = new Chart(canvas.value, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Calibration Relation',
          data: calibrationLinePoints.value,
          borderColor: primary,
          borderWidth: 1.5,
          backgroundColor: primary,
          pointRadius: 0,
          pointHoverRadius: 0,
          showLine: true,
          fill: false,
        },
        {
          label: 'Comparison Stars',
          data: candidatePoints.value,
          backgroundColor: primary,
          borderColor: primary,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: 'Target',
          data: targetPoints.value,
          backgroundColor: secondary,
          borderColor: secondary,
          pointRadius: 5,
          pointHoverRadius: 7,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Calibrated Magnitude', color: text },
          ticks: {
            color: text,
            callback: (value) => Number(value).toFixed(3),
          },
          grid: { color: background },
          reverse: true,
        },
        y: {
          type: 'logarithmic',
          title: { display: true, text: 'Net Source Counts', color: text },
          ticks: {
            color: text,
            callback: formatScientificTick,
            maxTicksLimit: 5,
          },
          grid: { color: background },
        }
      },
      plugins: {
        legend: {
          labels: { color: text }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw
              const label = context.dataset.label
              const name = point.candidateId ? `${point.candidateId}: ` : ''
              return `${label} ${name}mag ${Number(point.x).toFixed(3)}, net source counts ${Number(point.y).toFixed(0)}`
            }
          }
        }
      }
    }
  })
}

function formatScientificTick(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  const exponent = Math.floor(Math.log10(number))
  let coefficient = number / Math.pow(10, exponent)
  let adjustedExponent = exponent
  if (coefficient >= 9.9995) {
    coefficient = 1
    adjustedExponent += 1
  }
  return `${coefficient.toFixed(3)} x 10^${adjustedExponent}`
}

function magnitudeToCounts(magnitude, zeroPoint) {
  return 10 ** ((zeroPoint - magnitude) / 2.5)
}

function updateChart() {
  if (!chart) {
    nextTick(createChart)
    return
  }
  chart.data.datasets[0].data = calibrationLinePoints.value
  chart.data.datasets[1].data = candidatePoints.value
  chart.data.datasets[2].data = targetPoints.value
  chart.update()
}

watch(() => [props.rows, props.target], updateChart, { deep: true })

onMounted(() => {
  createChart()
})

onBeforeUnmount(() => {
  if (chart) {
    chart.destroy()
    chart = null
  }
})
</script>

<template>
  <div class="calibration-plot">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.calibration-plot {
  height: 240px;
  min-height: 240px;
  width: 100%;
  margin-top: 0.75rem;
}
</style>
