<script setup>
import Chart from 'chart.js/auto'
import { ref, watch } from 'vue'

const chartRef = ref(null)
let lineProfileChart = null

const props = defineProps({
  yAxisData: { type: Array, required: true },
  xAxisLength: { type: Number, default: null },
  startCoords: { type: Array, default: null },
  endCoords: { type: Array, default: null },
  positionAngle: { type: Number, default: null },
})

watch(() => [props.yAxisData, props.xAxisLength], () => {
  lineProfileChart ? updateChart() : createChart()
})

function createChart (){
  // chartJs can't use css vars as strings, so we need to get the actual value
  var style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')

  lineProfileChart = new Chart(chartRef.value, {
    type: 'line',
    data: {
      labels: generateLabels(),
      datasets: [
        {
          label: 'Flux',
          data: props.yAxisData,
          // Line styling
          borderColor: primary,
          borderWidth: 2,
          borderJoinStyle: 'round',
          backgroundColor: primary,
          // Point styling
          pointRadius: 0,
          // Point hover styling
          pointHitRadius: 10,
          pointHoverBorderColor: secondary,
          pointHoverBackgroundColor: secondary,
        },
      ],
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: distanceLabel(), color: text },
          border: { color: text, width: 2 },
          ticks: { color: text, autoSkip: true, autoSkipPadding: 10 , maxRotation: 0 },
          grid: { color: background },
        },
        y: {
          title: { display: true, text: 'Luminosity', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text, autoSkip: true, },
          grid: { color: background },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      hover: {
        mode: 'index',
        intersect: false,
      }
    },
  })
}

function updateChart(){
  lineProfileChart.data.labels = generateLabels()
  lineProfileChart.data.datasets[0].data = props.yAxisData
  lineProfileChart.options.scales.x.title.text = distanceLabel()
  lineProfileChart.update()
}

// Creates the labels for the x-axis
function generateLabels() {
  const length = props.xAxisLength
  const data = props.yAxisData
  
  if (!length) {
    // If image has no pixScale or WCS we don't have the arcsec length, use data to find pixel length
    return Array.from({ length: data.length }, (_, i) => i)
  }

  const step = length / (data.length - 1)
  return Array.from({ length: data.length }, (_, i) => (i * step).toFixed(0))
}

function distanceLabel(){
  if(props.xAxisLength){ 
    return (props.xAxisLength.toFixed(6) + ' Arcseconds') 
  }
  else { 
    return (props.yAxisData.length + ' Pixels')
  }
}
</script>

<template>
  <div>
    <canvas
      ref="chartRef"
      class="line-plot"
    />
    <div class="line-details">
      <template v-if="startCoords && endCoords">
        <p><b>Start:</b> RA {{ startCoords[0].toFixed(6) }} Dec {{ startCoords[1].toFixed(6) }}</p>
        <p><b>End:</b> RA {{ endCoords[0].toFixed(6) }} Dec {{ endCoords[1].toFixed(6) }}</p>
      </template>
      <p v-if="positionAngle">
        <v-tooltip
          activator="parent"
          text="Angle showing how a celestial object is rotated in the sky"
        />
        <b>Position Angle:</b> {{ positionAngle.toFixed(3) }}° East of North
      </p>
    </div>
  </div>
</template>

<style scoped>
.line-details {
  margin-top: 1rem;
}
.line-details p {
  font-size: medium;
}
</style>
