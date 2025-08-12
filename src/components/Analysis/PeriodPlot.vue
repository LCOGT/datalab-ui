<script setup>
import Chart from 'chart.js/auto'
import { ref, watch, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()
const periodCanvas = ref(null)
let periodChart = null
const DECIMAL_PLACES = 4

const probabilityChipColor = computed(() => {
  const ONE_SIGMA = 0.32
  const TWO_SIGMA = 0.045

  const fap = analysisStore.variableStarData.falseAlarmProbability
  if (fap < TWO_SIGMA) return 'var(--success)'
  if (fap < ONE_SIGMA) return 'var(--warning)'
  return 'var(--red)'
})

const chartData = computed(() => {
  const periodogram = analysisStore.variableStarData.magPeriodogram

  const period1 = periodogram.map(( p ) => ({ x: p.phase, y: p.mag}))
  const period2 = periodogram.map(( p ) => ({ x: p.phase + 1, y: p.mag}))

  return {
    period1: period1,
    period2: period2,
    period: (analysisStore.variableStarData.period).toFixed(DECIMAL_PLACES),
    falseAlarmPercentage: (analysisStore.variableStarData.falseAlarmProbability * 100).toFixed(DECIMAL_PLACES),
  }
})

watch(() => analysisStore.variableStarData, () => {
  periodChart && analysisStore.variableStarData.magPeriodogram ? updateChart() : createChart()
}, { deep: true})

function updateChart() {
  // Updates the chart when user runs flux analysis again
  const { period1, period2 } = chartData.value
  periodChart.data.datasets[0].data = period1
  periodChart.data.datasets[1].data = period2
  periodChart.update()
}

function createChart() {
  // chartJs can't use css vars as strings, so we need to get the actual value
  var style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')
  const info = style.getPropertyValue('--info')

  const { period1, period2 } = chartData.value

  periodChart = new Chart(periodCanvas.value, {
    data: {
      datasets: [
        {
          type: 'scatter',
          label: 'Period 1',
          data: period1,
          backgroundColor: primary,
          pointHoverBackgroundColor: info,
        },
        {
          type: 'scatter',
          label: 'Period 2',
          data: period2,
          backgroundColor: secondary,
          pointHoverBackgroundColor: info,
        },
      ]
    },
    options: {
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Phase', color: text },
          border: { color: text, width: 2 },
          ticks: {
            color: text, 
            stepSize: 0.25,
            callback: function(value) {
              return value.toFixed(2)
            }
          },
          grid: { color: background, tickColor: text },
        },
        y: {
          type: 'linear',
          title: { display: true, text: 'Magnitude', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text, stepSize: 0.2 },
          grid: { color: background, tickColor: text},
          grace: '5%',
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false },
      },
      hover: {
        intersect: false,
      }
    }
  })
}

</script>
<template>
  <div>
    <canvas
      ref="periodCanvas"
      class="period-plot"
    />
    <div class="d-flex ga-2 pb-2">
      <v-chip color="var(--info)">
        Period: {{ chartData.period }} days
      </v-chip>
      <v-chip :color="probabilityChipColor">
        False Alarm Probability: {{ chartData.falseAlarmPercentage }}%
      </v-chip>
    </div>
  </div>
</template>
