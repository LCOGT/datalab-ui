<script setup>
import Chart from 'chart.js/auto'
import 'chartjs-adapter-luxon'
import { ref, watch, computed, defineProps, onMounted } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'

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

// Chart data for brightness over linear time
const chartData = computed(() => {
  const magTimeSeries = [...props.variableStarData.magnitudeTimeSeries]
    .sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date))
  const dates = magTimeSeries.map(({ observation_date }) => observation_date)
  const magnitudes = magTimeSeries.map(({ mag }) => Number(mag.toFixed(DECIMAL_PLACES)))
  const errors = magTimeSeries.map(({ mag, magerr }) => {
    const lowerBound = Number((mag - magerr).toFixed(DECIMAL_PLACES))
    const upperBound = Number((mag + magerr).toFixed(DECIMAL_PLACES))
    return [lowerBound, upperBound]
  })
  
  // Formatted dict for the chart to use
  return {
    dates: dates,
    magnitudes: magnitudes,
    errors: errors,
    chartMin: Math.min(...magnitudes) - CHART_PADDING,
    chartMax: Math.max(...magnitudes) + CHART_PADDING
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
  const { dates, magnitudes, errors, chartMin, chartMax } = chartData.value
  lightCurveChart.data.labels = dates
  lightCurveChart.data.datasets[0].data = magnitudes
  lightCurveChart.data.datasets[1].data = errors
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

  const { dates, magnitudes, errors, chartMin, chartMax } = chartData.value

  lightCurveChart = new Chart(lightCurveCanvas.value, {
    type: 'scatter',
    data: {
      labels: dates,
      datasets: [
        { // Main magnitude dataset is a line chart
          label: 'Magnitude',
          data: magnitudes,
          order: 0,
          borderColor: primary,
          borderWidth: 2,
          borderJoinStyle: 'round',
          backgroundColor: primary,
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          pointHoverBorderColor: secondary,
          pointHoverBackgroundColor: secondary,
        },
        { // Error bar dataset is a bar chart overlaid
          label: 'Mag Error',
          data: errors,
          order: 1,
          type: 'bar',
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
        x: { // Formating the x time axis
          type: 'timeseries',
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
          }
        },
        y: {
          min: chartMin,
          max: chartMax,
          title: { display: true, text: 'Magnitude', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
          grid: { color: background, tickColor: text},
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
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
    <h4 class="title-lc">Light Curve</h4>
    <div class="light-curve-plot-wrapper">
      <canvas
        ref="lightCurveCanvas"
        class="light-curve-plot"
      />
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(lightCurveChart, 'light-curve.png', 'Light Curve')"
      />
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
}
.title-lc {
  align-self: center;
}
.light-curve-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;
  width: 100%;
}
.light-curve-plot {
  height: 100% !important;
}
.download-btn {
  margin-left: 1rem;
  margin-bottom: 1rem;
  align-self: flex-end;
}
</style>
