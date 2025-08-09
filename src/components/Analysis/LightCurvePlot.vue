<script setup>
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { ref, watch, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()
const lightCurveCanvas = ref(null)
let lightCurveChart = null
const CHART_PADDING = 0.05
const DECIMAL_PLACES = 4

const chartData = computed(() => {
  const dates = analysisStore.variableStarData.magTimeSeries.map(({ julian_date }) => julian_date)
  const magnitudes = analysisStore.variableStarData.magTimeSeries.map(({ mag }) => mag.toFixed(DECIMAL_PLACES))
  const errors = analysisStore.variableStarData.magTimeSeries.map(({ mag, magerr }) => {
    const lowerBound = (mag - magerr).toFixed(DECIMAL_PLACES)
    const upperBound = (mag + magerr).toFixed(DECIMAL_PLACES)
    return [lowerBound, upperBound]
  })

  return {
    dates: dates,
    magnitudes: magnitudes,
    errors: errors,
    chartMin: Math.min(...magnitudes) - CHART_PADDING,
    chartMax: Math.max(...magnitudes) + CHART_PADDING
  }
})

watch(() => analysisStore.variableStarData, () => {
  lightCurveChart && analysisStore.variableStarData.magTimeSeries ? updateChart() : createChart()
}, { deep: true})

function updateChart() {
  // Updates the chart when user runs flux analysis again
  const { dates, magnitudes, errors, chartMin, chartMax } = chartData.value
  lightCurveChart.data.labels = dates
  lightCurveChart.data.datasets[0].data = magnitudes
  lightCurveChart.data.datasets[1].data = errors
  lightCurveChart.options.scales.y.min = chartMin
  lightCurveChart.options.scales.y.max = chartMax
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

  const { dates, magnitudes, errors, chartMin, chartMax } = chartData.value

  lightCurveChart = new Chart(lightCurveCanvas.value, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Magnitude',
          data: magnitudes,
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
          data: errors,
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
          type: 'timeseries',
          title: { display: true, text: 'Date', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
          grid: { color: background },
          time: {
            unit: 'day',
            tooltipFormat: 'MMM dd hh:mm a',
            displayFormats: {
              day: 'M/dd T'
            },
          }
        },
        y: {
          min: chartMin,
          max: chartMax,
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
  <canvas
    ref="lightCurveCanvas"
    class="light-curve-plot"
  />
</template>
