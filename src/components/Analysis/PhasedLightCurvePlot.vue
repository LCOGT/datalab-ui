<script setup>
import Chart from 'chart.js/auto'
import { ref, watch, computed, defineProps, onMounted } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'

const props = defineProps({
  variableStarData: {
    type: Object,
    required: true
  },
  periodogramData: {
    type: Object,
    required: true
  }
})

const periodCanvas = ref(null)
let periodChart = null
const DECIMAL_PLACES = 4

// Determines color of the false alarm probability chip
const probabilityChipColor = computed(() => {
  const ONE_SIGMA = 0.32
  const TWO_SIGMA = 0.045

  const fap = props.variableStarData.falseAlarmProbability
  if (fap < TWO_SIGMA) return 'var(--success)'
  if (fap < ONE_SIGMA) return 'var(--warning)'
  return 'var(--red)'
})

// Periodogram data formatted for chartJs
const chartData = computed(() => {
  const periodogram = props.variableStarData.magPhasedLightCurve

  const period1 = periodogram.map(( p ) => ({ x: p.phase, y: p.mag}))
  const period2 = periodogram.map(( p ) => ({ x: p.phase + 1, y: p.mag}))

  return {
    period1: period1,
    period2: period2,
    period: (props.variableStarData.period).toFixed(DECIMAL_PLACES),
    falseAlarmPercentage: (props.variableStarData.falseAlarmProbability * 100).toFixed(DECIMAL_PLACES),
  }
})

watch(() => props.variableStarData, () => {
  periodChart && props.variableStarData.magPhasedLightCurve ? updateChart() : createChart()
}, { deep: true})

function updateChart() {
  // Updates the chart with new data
  const { period1, period2 } = chartData.value
  periodChart.data.datasets[0].data = period1
  periodChart.data.datasets[1].data = period2
  // Call Chart.js update method
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
        { // First Period
          type: 'scatter',
          label: 'Period 1',
          data: period1,
          backgroundColor: primary,
          pointHoverBackgroundColor: info,
        },
        { // Second Period (Phase + 1)
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
          reverse: true
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

onMounted(() => {
  if (props.variableStarData.magPhasedLightCurve) {
    createChart()
  }
})

</script>
<template>
  <div class="wrapper">
    <h4 class="title-plc">
      Phased Light Curve
    </h4>
    <div class="period-plot-wrapper">
      <canvas
        ref="periodCanvas"
        class="period-plot"
      />
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(periodChart, 'period-plot.png', 'Phased Light Curve')"
      />
      <div class="chip-row">
        <v-chip color="var(--info)">
          Period: {{ chartData.period }} days
        </v-chip>
        <v-chip :color="probabilityChipColor">
          False Alarm Probability: {{ chartData.falseAlarmPercentage }}%
        </v-chip>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
}
.title-plc {
  align-self: center;
}
.period-plot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 100%;
}
.period-plot {
  height: 100% !important;
}
.download-btn {
  margin-left: 1rem;
  margin-bottom: 1rem;
  align-self: flex-end;
}
.chip-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2.5vh;
}
</style>
