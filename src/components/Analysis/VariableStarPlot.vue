<script setup>
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { ref, watch, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()
const lightCurveCanvas = ref(null)
let lightCurveChart = null
const CHART_PADDING = 0.05

const chartData = computed(() => {
  const magnitudes = analysisStore.variableStarData.magTimeSeries.map(({ mag }) => mag)
  const phases = analysisStore.variableStarData.magTimeSeries.map(({ phase }) => phase)
  const errorBars = analysisStore.variableStarData.magTimeSeries.map(({ mag, magerr }) => [mag - magerr, mag + magerr])

  return {
    phases: phases,
    magnitudes: magnitudes,
    errorData: errorBars,
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
  lightCurveChart && analysisStore.variableStarData.magTimeSeries ? updateChart() : createChart()
}, { deep: true})

function updateChart() {
  // Updates the chart when user runs flux analysis again
  lightCurveChart.data.labels = chartData.value.phases
  lightCurveChart.data.datasets[0].data = chartData.value.magnitudes
  lightCurveChart.data.datasets[1].data = chartData.value.errorData
  lightCurveChart.options.scales.y.min = chartData.value.chartMin
  lightCurveChart.options.scales.y.max = chartData.value.chartMax
  lightCurveChart.update()
}

function createChart() {
  // chartJs can't use css vars as strings, so we need to get the actual value
  var style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')
  const info = style.getPropertyValue('--info')

  lightCurveChart = new Chart(lightCurveCanvas.value, {
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
          data: chartData.value.errorData,
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
      ref="lightCurveCanvas"
      class="light-curve-plot"
    />
    <div class="d-flex ga-2 pb-2">
      <v-chip color="var(--info)">
        Period: {{ analysisStore.variableStarData.period }} days
      </v-chip>
      <v-chip :color="probabilityChipColor">
        False Alarm Probability: {{ analysisStore.variableStarData.falseAlarmProbability }}
      </v-chip>
    </div>
  </div>
</template>
