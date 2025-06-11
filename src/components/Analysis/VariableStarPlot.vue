<script setup>
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { ref, watch } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()
const lightCurveCanvas = ref(null)
let lightCurveChart = null
const CHART_PADDING = 0.05

watch(() => [analysisStore.lightCurve], () =>{
  lightCurveChart ? updateChart() : createChart()
})

function getChartData() {
  // We use this function to extract the data from the analysisStore to avoid
  // writing it twice in the chart creation and update functions.
  return {
    labels: analysisStore.lightCurve.map(({ observation_date }) => observation_date),
    magnitudeData: analysisStore.lightCurve.map(({ mag }) => mag),
    errorData: analysisStore.lightCurve.map(({ mag, magerr }) => [mag - magerr, mag + magerr]),
    chartMin: Math.min(...analysisStore.lightCurve.map(({ mag }) => mag)) - CHART_PADDING,
    chartMax: Math.max(...analysisStore.lightCurve.map(({ mag }) => mag)) + CHART_PADDING
  }
}

function updateChart() {
  // Updates the chart when user runs flux analysis again
  lightCurveChart.data.labels = getChartData().labels
  lightCurveChart.data.datasets[0].data = getChartData().magnitudeData
  lightCurveChart.data.datasets[1].data = getChartData().errorData
  lightCurveChart.options.scales.y.min = getChartData().chartMin
  lightCurveChart.options.scales.y.max = getChartData().chartMax
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
      labels: getChartData().labels,
      datasets: [
        {
          label: 'Magnitude',
          data: getChartData().magnitudeData,
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
          data: getChartData().errorData,
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
          title: { display: true, text: 'Observation Date', color: text },
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
          min: getChartData().chartMin,
          max: getChartData().chartMax,
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
