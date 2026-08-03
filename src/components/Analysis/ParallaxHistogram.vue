<script setup>
import Chart from 'chart.js/auto'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'
import { getThemeColors, DIMMED_COLOR } from '@/utils/analysisCharts.js'
import { useHistogramWindowSelect } from '@/utils/histogramWindowSelect.js'

/*
  Histogram of the Gaia parallaxes of the matched stars. Cluster stars pile up at a
  common parallax (distance) while field stars spread out. Bars inside the selected
  [parallax_min, parallax_max] membership window keep the primary color, bars outside
  are dimmed. The window is selected with two vertical lines (useHistogramWindowSelect):
  with no window yet, drag across the plot to draw one out; once it exists, drag either
  line left/right to adjust (both emitted through v-model:parallax-min / v-model:parallax-max).
  Negative parallaxes (distant stars with noisy measurements) are real data and are
  binned like any other value.
*/

const props = defineProps({
  cmd: {
    type: Array,
    required: true
  },
  parallaxMin: {
    type: Number,
    default: null
  },
  parallaxMax: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:parallaxMin', 'update:parallaxMax'])

const parallaxCanvas = ref(null)
let parallaxChart = null
let themeColors = {}

const BIN_COUNT = 30

const parallaxes = computed(() => {
  return props.cmd
    .filter((star) => star.gaia_match && Number.isFinite(star.parallax))
    .map((star) => star.parallax)
})

const histogram = computed(() => {
  const values = parallaxes.value
  if (!values.length) return { centers: [], counts: [], binWidth: 0, minEdge: 0 }

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    // a degenerate single-valued distribution still needs a nonzero bin width
    min -= 0.5
    max += 0.5
  }
  const binWidth = (max - min) / BIN_COUNT
  const counts = new Array(BIN_COUNT).fill(0)
  for (const value of values) {
    const bin = Math.min(Math.floor((value - min) / binWidth), BIN_COUNT - 1)
    counts[bin] += 1
  }
  const centers = counts.map((_, index) => min + (index + 0.5) * binWidth)
  return { centers: centers, counts: counts, binWidth: binWidth, minEdge: min }
})

// value <-> pixel on the category axis: the bins are uniform, so a parallax maps linearly onto
// the plot (bin i is centered at (i + 0.5) / N of the width). These take the chart as an
// argument because the window plugin can fire during the Chart constructor's first draw, before
// the component's chart variable is assigned
function valueToPixel(chart, value) {
  const { centers, binWidth, minEdge } = histogram.value
  const area = chart.chartArea
  const fraction = (value - minEdge) / (binWidth * centers.length)
  return area.left + fraction * (area.right - area.left)
}

function pixelToValue(chart, pixel) {
  const { centers, binWidth, minEdge } = histogram.value
  const area = chart.chartArea
  const fraction = (pixel - area.left) / (area.right - area.left)
  return minEdge + fraction * (binWidth * centers.length)
}

// the draggable two-line min/max window (plugin + pointer handlers), shared with DistanceHistogram
const { windowActive, plugin: windowPlugin, attach: attachWindow, detach: detachWindow } = useHistogramWindowSelect({
  chart: () => parallaxChart,
  min: () => props.parallaxMin,
  max: () => props.parallaxMax,
  emitMin: (value) => emit('update:parallaxMin', value),
  emitMax: (value) => emit('update:parallaxMax', value),
  valueToPixel,
  pixelToValue,
  extent: () => {
    const { centers, binWidth, minEdge } = histogram.value
    return centers.length ? { min: minEdge, max: minEdge + binWidth * centers.length } : null
  },
  round: (value) => Math.round(value * 10000) / 10000,
  lineColor: () => themeColors.secondary
})

// bars inside the selection window stay primary, the rest are dimmed
const barColors = computed(() => {
  const { centers, binWidth } = histogram.value
  return centers.map((center) => {
    if (!windowActive()) return themeColors.primary
    const inWindow = center + binWidth / 2 >= props.parallaxMin && center - binWidth / 2 <= props.parallaxMax
    return inWindow ? themeColors.primary : DIMMED_COLOR
  })
})

function tooltipLines(context) {
  const { centers, binWidth } = histogram.value
  const center = centers[context.dataIndex]
  const lower = (center - binWidth / 2).toFixed(3)
  const upper = (center + binWidth / 2).toFixed(3)
  return [`${context.parsed.y} stars`, `parallax ${lower} to ${upper} mas`]
}

function updateChart() {
  const { centers, counts } = histogram.value
  parallaxChart.data.labels = centers.map((center) => center.toFixed(2))
  parallaxChart.data.datasets[0].data = counts
  parallaxChart.data.datasets[0].backgroundColor = barColors.value
  parallaxChart.update()
}

function createChart() {
  themeColors = getThemeColors()

  const { centers, counts } = histogram.value

  parallaxChart = new Chart(parallaxCanvas.value, {
    type: 'bar',
    data: {
      labels: centers.map((center) => center.toFixed(2)),
      datasets: [{
        label: 'Stars',
        data: counts,
        backgroundColor: barColors.value,
        hoverBackgroundColor: themeColors.secondary,
        barPercentage: 0.95,
        categoryPercentage: 1.0
      }]
    },
    plugins: [windowPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          title: { display: true, text: 'parallax (mas)', color: themeColors.text },
          border: { color: themeColors.text, width: 2 },
          ticks: { color: themeColors.text, maxTicksLimit: 11 },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'stars', color: themeColors.text },
          border: { color: themeColors.text, width: 2 },
          ticks: { color: themeColors.text, precision: 0 },
          grid: { color: themeColors.background, tickColor: themeColors.text }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: tooltipLines } }
      }
    }
  })
}

watch(() => [props.cmd, props.parallaxMin, props.parallaxMax], () => {
  if (parallaxChart) {
    updateChart()
  }
}, { deep: true })

onMounted(() => {
  createChart()
  attachWindow()
})

onBeforeUnmount(() => {
  detachWindow()
})

</script>
<template>
  <div class="wrapper">
    <p class="title-parallax">
      Parallaxes
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(parallaxChart, 'parallaxes.png', 'Parallaxes')"
      />
    </p>
    <div class="parallax-plot-wrapper">
      <canvas
        ref="parallaxCanvas"
        class="parallax-plot"
      />
    </div>
    <p class="drag-hint">
      {{ windowActive()
        ? 'Drag the dashed lines to adjust the parallax window'
        : 'Drag across the plot to select a parallax window' }}
    </p>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.title-parallax {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1rem;
}
.parallax-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}
.parallax-plot {
  width: 100% !important;
  height: 100% !important;
  touch-action: none;
}
.drag-hint {
  align-self: center;
  font-size: 0.75rem;
  color: var(--info);
  margin: 0.25rem 0 0;
}
.download-btn {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}
</style>
