<script setup>
import Chart from 'chart.js/auto'
import { ref, watch } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'


const analysisStore = useAnalysisStore()
const lightCurveCanvas = ref(null)
let lightCurveChart = null

watch(() => [analysisStore.lightCurve], () =>{
  lightCurveChart ? updateChart() : createChart()
})

function createChart() {
  // chartJs can't use css vars as strings, so we need to get the actual value
  var style = getComputedStyle(document.body)
  const text = style.getPropertyValue('--text')
  const primary = style.getPropertyValue('--primary-interactive')
  const secondary = style.getPropertyValue('--secondary-interactive')

  lightCurveChart = new Chart(lightCurveCanvas.value, {
    type: 'line',
    data: {
      labels: analysisStore.lightCurve.map((observation) => observation.observation_date),
      datasets: [
        {
          label: 'Magnitude',
          data: analysisStore.lightCurve.map((observation) => observation.mag),
          // Line styling
          borderColor: primary,
          borderWidth: 2,
          borderJoinStyle: 'round',
          backgroundColor: primary,
          // Point hover styling
          pointHitRadius: 10,
          pointHoverBorderColor: secondary,
          pointHoverBackgroundColor: secondary,
        }
      ]
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: 'Observation Date', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
        },
        y: {
          title: { display: true, text: 'Magnitude', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text },
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false },
      },
    }
  })
}

function updateChart() {
  lightCurveChart.data.labels = analysisStore.lightCurve.map((observation) => observation.observation_date)
  lightCurveChart.data.datasets[0].data = analysisStore.lightCurve.map((observation) => observation.mag)
  lightCurveChart.update()
}

</script>
<template>
  <h1>Light Curve</h1>
  <canvas
    ref="lightCurveCanvas"
    class="light-curve-plot"
  />
  <v-progress-linear
    v-if="analysisStore.lightCurveLoading"
    color="var(--success)"
    :height="6"
    indeterminate
    rounded
  />
</template>
