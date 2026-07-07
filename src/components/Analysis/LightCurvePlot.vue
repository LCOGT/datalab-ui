<script setup>
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { ref, watch, computed, defineProps, onMounted } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'
import { normalizeLightCurveRows } from '@/utils/lightCurve.js'
import { loessPoints } from '@/utils/lightCurveFit.js'

const props = defineProps({
  variableStarData: {
    type: Object,
    required: true
  }
})

const lightCurveCanvas = ref(null)
let lightCurveChart = null
const CHART_PADDING = 0.5
const DECIMAL_PLACES = 4
const ERROR_BAR_CAP_WIDTH = 8
const X_AXIS_LEFT_PADDING_RATIO = 0.05
const MIN_X_AXIS_LEFT_PADDING_MS = 60 * 60 * 1000

const errorBarPlugin = {
  id: 'lightCurveErrorBars',
  afterDatasetsDraw(chart) {
    const errors = chart.options.plugins.lightCurveErrorBars?.errors || []
    const color = chart.options.plugins.lightCurveErrorBars?.color
    const datasetMeta = chart.getDatasetMeta(0)
    const yScale = chart.scales.y

    if (!datasetMeta || !yScale) return

    const ctx = chart.ctx
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5

    datasetMeta.data.forEach((point, index) => {
      const bounds = errors[index]
      if (!bounds || !point) return

      const [lowerBound, upperBound] = bounds
      const lowerY = yScale.getPixelForValue(lowerBound)
      const upperY = yScale.getPixelForValue(upperBound)
      const x = point.x
      const cap = ERROR_BAR_CAP_WIDTH / 2

      ctx.beginPath()
      ctx.moveTo(x, lowerY)
      ctx.lineTo(x, upperY)
      ctx.moveTo(x - cap, lowerY)
      ctx.lineTo(x + cap, lowerY)
      ctx.moveTo(x - cap, upperY)
      ctx.lineTo(x + cap, upperY)
      ctx.stroke()
    })

    ctx.restore()
  }
}

// Chart data for brightness over linear time
const chartData = computed(() => {
  const magTimeSeries = normalizeLightCurveRows(props.variableStarData.magnitudeTimeSeries)
    .sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date))
  const dates = magTimeSeries.map(({ observation_date }) => observation_date)
  const magnitudes = magTimeSeries.map(({ mag }) => Number(mag.toFixed(DECIMAL_PLACES)))
  const dateValues = dates
    .map(date => new Date(date).getTime())
    .filter(Number.isFinite)
  const minDate = Math.min(...dateValues)
  const maxDate = Math.max(...dateValues)
  const magerrs = magTimeSeries.map(({ magerr }) => magerr)
  const magnitudePoints = magnitudes.map((magnitude, index) => ({ x: dateValues[index], y: magnitude }))
  const trendPoints = loessPoints(dateValues, magnitudes, magerrs, minDate, maxDate)
  const errors = magTimeSeries.map(({ mag, magerr }) => {
    if (!Number.isFinite(magerr)) return null
    const lowerBound = Number((mag - magerr).toFixed(DECIMAL_PLACES))
    const upperBound = Number((mag + magerr).toFixed(DECIMAL_PLACES))
    return [lowerBound, upperBound]
  })
  const errorBounds = errors.flatMap(error => error || [])
  const trendMagnitudes = trendPoints.map(point => point.y)
  const plotValues = [...magnitudes, ...errorBounds, ...trendMagnitudes]
  const minMagnitude = Math.min(...plotValues)
  const maxMagnitude = Math.max(...plotValues)
  const leftTimePadding = Math.max((maxDate - minDate) * X_AXIS_LEFT_PADDING_RATIO, MIN_X_AXIS_LEFT_PADDING_MS)
  
  // Formatted dict for the chart to use
  return {
    dates: dates,
    magnitudes: magnitudes,
    magnitudePoints: magnitudePoints,
    trendPoints: trendPoints,
    errors: errors,
    chartMin: minMagnitude - CHART_PADDING,
    chartMax: maxMagnitude + CHART_PADDING,
    chartMinDate: minDate - leftTimePadding,
  }
})

watch(() => props.variableStarData, () => {
  if (lightCurveChart && props.variableStarData.magnitudeTimeSeries) {
    updateChart()
  } else if (lightCurveCanvas.value) {
    createChart()
  }
}, { deep: true })


function updateChart() {
  // Set all the new data
  const { dates, magnitudePoints, trendPoints, errors, chartMin, chartMax, chartMinDate } = chartData.value
  lightCurveChart.data.labels = dates
  lightCurveChart.data.datasets[0].data = magnitudePoints
  lightCurveChart.data.datasets[1].data = trendPoints
  lightCurveChart.options.scales.x.min = chartMinDate
  lightCurveChart.options.scales.x.max = undefined
  lightCurveChart.options.plugins.lightCurveErrorBars.errors = errors
  lightCurveChart.options.scales.y.min = chartMin
  lightCurveChart.options.scales.y.max = chartMax
  // Call Chart.js update method
  lightCurveChart.update()
}

function createChart() {
  // chartJs can't use css vars as strings, so we need to get the values
  var style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')
  const info = style.getPropertyValue('--info')

  const { dates, magnitudePoints, trendPoints, errors, chartMin, chartMax, chartMinDate } = chartData.value
  if (!magnitudePoints.length) return

  lightCurveChart = new Chart(lightCurveCanvas.value, {
    type: 'scatter',
    plugins: [errorBarPlugin],
    data: {
      labels: dates,
      datasets: [
        { // Main magnitude dataset is a line chart
          label: 'Magnitude',
          data: magnitudePoints,
          order: 0,
          showLine: false,
          borderColor: primary,
          borderWidth: 2,
          borderJoinStyle: 'round',
          backgroundColor: primary,
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          pointHoverBorderColor: secondary,
          pointHoverBackgroundColor: secondary,
        },
        {
          label: 'LOESS Fit',
          data: trendPoints,
          order: 1,
          borderColor: secondary,
          borderWidth: 2,
          backgroundColor: secondary,
          pointRadius: 0,
          pointHoverRadius: 0,
          showLine: true,
          fill: false,
          parsing: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { // Formating the x time axis
          type: 'timeseries',
          min: chartMinDate,
          title: { display: true, text: 'Date', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
          grid: { color: background, tickColor: text},
          time: {
            unit: 'day',
            tooltipFormat: 'MMM dd hh:mm a',
            displayFormats: {
              day: 'M/dd T'
            },
          },
        },
        y: {
          min: chartMin,
          max: chartMax,
          title: { display: true, text: 'Magnitude', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
          grid: { color: background, tickColor: text},
          reverse: true
        }
      },
      plugins: {
        lightCurveErrorBars: {
          color: info,
          errors: errors,
        },
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          filter: (context) => context.datasetIndex === 0,
          callbacks: {
            label: (context) => {
              const error = chartData.value.errors[context.dataIndex]
              const mag = Number(context.parsed.y).toFixed(DECIMAL_PLACES)
              if (!error) return `Magnitude: ${mag}`
              const magError = Math.abs(error[1] - error[0]) / 2
              return `Magnitude: ${mag} +/- ${magError.toFixed(DECIMAL_PLACES)}`
            }
          }
        },
      },
      hover: { // A more permissive hover that doesn't require intersecting a point
        mode: 'index',
        intersect: false,
      }
    }
  })
}

onMounted(() => {
  createChart()
})

</script>
<template>
  <div class="wrapper">
    <p class="title-lc">
      Light Curve 
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(lightCurveChart, 'light-curve.png', 'Light Curve')"
      />
    </p>
    <div class="light-curve-plot-wrapper">
      <canvas
        ref="lightCurveCanvas"
        class="light-curve-plot"
      />
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  width: min(100%, 1120px);
  height: 100%;
  min-height: 0;
}
.title-lc {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1rem;
}
.light-curve-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}
.light-curve-plot {
  width: 100% !important;
  height: 100% !important;
}
.download-btn {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}
</style>
