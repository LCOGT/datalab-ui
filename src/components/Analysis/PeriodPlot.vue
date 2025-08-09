<script setup>
import Chart from 'chart.js/auto'
import { ref, watch, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()
const periodCanvas = ref(null)
let periodChart = null
const CHART_PADDING = 0.05
const DECIMAL_PLACES = 4

const chartData = computed(() => {
  const phases = analysisStore.variableStarData.magPeriodogram.map(({ phase }) => phase.toFixed(DECIMAL_PLACES))
  const magnitudes = analysisStore.variableStarData.magPeriodogram.map(({ mag }) => mag.toFixed(DECIMAL_PLACES))
  const errors = analysisStore.variableStarData.magPeriodogram.map(({ mag, magerr }) => {
    const lowerBound = (mag - magerr).toFixed(DECIMAL_PLACES)
    const upperBound = (mag + magerr).toFixed(DECIMAL_PLACES)
    return [lowerBound, upperBound]
  })

  return {
    phases: phases,
    magnitudes: magnitudes,
    errors: errors,
    period: (analysisStore.variableStarData.period).toFixed(DECIMAL_PLACES),
    falseAlarmPercentage: (analysisStore.variableStarData.falseAlarmProbability * 100).toFixed(DECIMAL_PLACES),
    chartMin: Math.min(...magnitudes) - CHART_PADDING,
    chartMax: Math.max(...magnitudes) + CHART_PADDING
  }
})

const probabilityChipColor = computed(() => {
  const ONE_SIGMA = 0.32
  const TWO_SIGMA = 0.045

  const fap = analysisStore.variableStarData.falseAlarmProbability
  if (fap < TWO_SIGMA) return 'var(--success)'
  if (fap < ONE_SIGMA) return 'var(--warning)'
  return 'var(--red)'
})

watch(() => analysisStore.variableStarData, () => {
  periodChart && analysisStore.variableStarData.magPeriodogram ? updateChart() : createChart()
}, { deep: true})

function updateChart() {
  // Updates the chart when user runs flux analysis again
  const { phases, magnitudes, errors, chartMin, chartMax } = chartData.value
  periodChart.data.labels = phases
  periodChart.data.datasets[0].data = magnitudes
  periodChart.data.datasets[1].data = errors
  periodChart.options.scales.y.min = chartMin
  periodChart.options.scales.y.max = chartMax
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

  periodChart = new Chart(periodCanvas.value, {
    type: 'line',
    data: {
      labels: chartData.value.phases,
      datasets: [
        {
          label: 'Magnitude',
          data: chartData.value.magnitudes,
          order: 0,
          // Line styling
          borderColor: primary,
          borderWidth: 2,
          borderJoinStyle: 'round',
          backgroundColor: primary,
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          // Point hover styling
          pointHoverBorderColor: secondary,
          pointHoverBackgroundColor: secondary,
        },
        {
          label: 'Mag Error',
          data: chartData.value.errors,
          order: 1,
          type: 'bar',
          // Error bar styling
          borderColor: info,
          backgroundColor: info,
          barPercentage: 0.1,
          hoverBackgroundColor: secondary,
          hoverBorderColor: secondary,
        }
      ]
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: 'Phase', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
          grid: { color: background },
        },
        y: {
          min: chartData.value.chartMin,
          max: chartData.value.chartMax,
          title: { display: true, text: 'Magnitude', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
          grid: { color: background },
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      hover: {
        mode: 'index',
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
