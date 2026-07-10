<script setup>
import Chart from 'chart.js/auto'
import { ref, watch, computed, defineProps, onMounted, nextTick } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'
import { normalizeLightCurveRows } from '@/utils/lightCurve.js'

const props = defineProps({
  variableStarData: {
    type: Object,
    required: true
  }
})

const lightCurveCanvas = ref(null)
const titleInput = ref(null)
const userTitle = ref('')
const isEditingTitle = ref(false)
const hiddenTelescopeSizes = ref(new Set())
let lightCurveChart = null
const DEFAULT_CHART_TITLE = 'Add a Title'
const CHART_PADDING = 0.5
const DECIMAL_PLACES = 4
const MJD_DECIMAL_PLACES = 4
const DAY_OFFSET_DECIMAL_PLACES = 2
const MAGNITUDE_TICK_STEP = 0.25
const ERROR_BAR_CAP_WIDTH = 8
const X_AXIS_LEFT_PADDING_RATIO = 0.05
const MIN_X_AXIS_LEFT_PADDING_DAYS = 1 / 24
const MJD_UNIX_EPOCH = 40587
const MS_PER_DAY = 24 * 60 * 60 * 1000
const TELESCOPE_COLORS = {
  '0.4m': '--blue',
  '1m': '--orange',
  '2m': '--green',
  '4m': '--red',
}
const TELESCOPE_LABELS = [
  { key: '0.4m', label: '0.4m Telescope' },
  { key: '1m', label: '1m Telescope' },
  { key: '2m', label: '2m Telescope' },
  { key: '4m', label: '4m Telescope' },
]

const errorBarPlugin = {
  id: 'lightCurveErrorBars',
  afterDatasetsDraw(chart) {
    const errors = chart.options.plugins.lightCurveErrorBars?.errors || []
    const datasetMeta = chart.getDatasetMeta(0)
    const yScale = chart.scales.y

    if (!datasetMeta || !yScale) return

    const ctx = chart.ctx
    ctx.save()
    ctx.lineWidth = 1.5

    datasetMeta.data.forEach((point, index) => {
      const bounds = errors[index]
      const [lowerBound, upperBound] = bounds
      const dataPoint = chart.data.datasets[0].data[index]
      ctx.strokeStyle = dataPoint?.telescopeColor
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

function dateToMjd(date) {
  const time = new Date(date).getTime()
  return (time / MS_PER_DAY) + MJD_UNIX_EPOCH
}

function formatMjd(value) {
  return Number(value).toFixed(MJD_DECIMAL_PLACES)
}

function formatDayOffset(value) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(DAY_OFFSET_DECIMAL_PLACES)} d`
}

function telescopeColorMap(style) {
  return Object.fromEntries(
    Object.entries(TELESCOPE_COLORS).map(([key, color]) => [key, style.getPropertyValue(color).trim()])
  )
}

function telescopeLegendLabels(style) {
  const telescopeColors = telescopeColorMap(style)
  return TELESCOPE_LABELS.map(item => ({
    ...item,
    color: telescopeColors[item.key],
    hidden: hiddenTelescopeSizes.value.has(item.key),
  }))
}

const telescopeLegendItems = computed(() => {
  return telescopeLegendLabels(getComputedStyle(document.body))
})

function telescopeSizeFromFitsPath(fitspath) {
  const text = String(fitspath).trim().toLowerCase()

  if (/(^|[^0-9])0[.]?4\s*m|0m4|40\s*cm/.test(text)) return '0.4m'
  if (/(^|[^0-9])1(?:[.]0)?\s*m|1m0/.test(text)) return '1m'
  if (/(^|[^0-9])2(?:[.]0)?\s*m|2m0/.test(text)) return '2m'
  if (/(^|[^0-9])4(?:[.]0)?\s*m|4m0/.test(text)) return '4m'
}

const chartTitle = computed(() => {
  return `${userTitle.value.trim() || DEFAULT_CHART_TITLE} - Light Curve`
})

const sourceInfo = computed(() => {
  const source = props.variableStarData?.source
  if (source.name) return `Source: ${source.name}`

  const ra = Number(source.ra).toFixed(3)
  const dec = Number(source.dec).toFixed(3)
  return ra && dec ? `RA: ${ra}, Dec: ${dec}` : ''
})

const apertureInfo = computed(() => {
  const aperture = props.variableStarData?.aperture
  const apertureRadius = aperture.apertureRadius
  const annulusInnerRadius = aperture.annulusInnerRadius
  const annulusOuterRadius = aperture.annulusOuterRadius

  return `Aperture radius: ${apertureRadius}"; Annulus radii: ${annulusInnerRadius}", ${annulusOuterRadius}" `
})

const chartSubtitleText = computed(() => {
  return [sourceInfo.value, apertureInfo.value].filter(Boolean)
})

const downloadTitle = computed(() => {
  return [chartTitle.value, ...chartSubtitleText.value]
})

function startEditingTitle() {
  isEditingTitle.value = true
  nextTick(() => titleInput.value?.focus())
}

function stopEditingTitle() {
  userTitle.value = userTitle.value.trim()
  isEditingTitle.value = false
}

function visiblePoint(point) {
  return !point.telescopeSize || !hiddenTelescopeSizes.value.has(point.telescopeSize)
}

// Chart data for brightness over linear time
const chartData = computed(() => {
  const magTimeSeries = normalizeLightCurveRows(props.variableStarData.magnitudeTimeSeries)
    .map(row => ({ ...row, mjd: dateToMjd(row.observation_date) }))
    .filter(row => Number.isFinite(row.mjd))
    .sort((a, b) => a.mjd - b.mjd)
  if (!magTimeSeries.length) {
    return {
      baseMjd: 0,
      magnitudes: [],
      magnitudePoints: [],
      pointColors: [],
      errors: [],
      chartMin: 0,
      chartMax: 1,
      chartMinMjd: 0,
    }
  }

  const baseMjd = magTimeSeries[0]?.mjd ?? 0
  const magnitudes = magTimeSeries.map(({ mag }) => Number(mag.toFixed(DECIMAL_PLACES)))
  const mjdValues = magTimeSeries.map(({ mjd }) => mjd)
  const minMjd = Math.min(...mjdValues)
  const maxMjd = Math.max(...mjdValues)
  const style = getComputedStyle(document.body)
  const telescopeColors = telescopeColorMap(style)
  const allMagnitudePoints = magTimeSeries.map((row, index) => ({
    ...row,
    x: row.mjd,
    y: magnitudes[index],
    dayOffset: row.mjd - baseMjd,
    observationDate: row.observation_date,
    telescopeSize: telescopeSizeFromFitsPath(row.fits_path),
  })).map(point => ({
    ...point,
    telescopeColor: telescopeColors[point.telescopeSize],
    error: (() => {
      const lowerBound = Number((point.mag - point.magerr).toFixed(DECIMAL_PLACES))
      const upperBound = Number((point.mag + point.magerr).toFixed(DECIMAL_PLACES))
      return [lowerBound, upperBound]
    })(),
  }))
  const magnitudePoints = allMagnitudePoints.filter(visiblePoint)
  const errors = magnitudePoints.map(point => point.error)
  const errorBounds = errors.flatMap(error => error || [])
  const plotValues = [...magnitudePoints.map(point => point.y), ...errorBounds]
  if (!plotValues.length) {
    return {
      baseMjd: baseMjd,
      magnitudes: [],
      magnitudePoints: [],
      pointColors: [],
      errors: [],
      chartMin: 0,
      chartMax: 1,
      chartMinMjd: minMjd - Math.max((maxMjd - minMjd) * X_AXIS_LEFT_PADDING_RATIO, MIN_X_AXIS_LEFT_PADDING_DAYS),
    }
  }
  const minMagnitude = Math.min(...plotValues)
  const maxMagnitude = Math.max(...plotValues)
  const leftTimePadding = Math.max((maxMjd - minMjd) * X_AXIS_LEFT_PADDING_RATIO, MIN_X_AXIS_LEFT_PADDING_DAYS)
  
  // Formatted dict for the chart to use
  return {
    baseMjd: baseMjd,
    magnitudes: magnitudes,
    magnitudePoints: magnitudePoints,
    pointColors: magnitudePoints.map(point => point.telescopeColor),
    errors: errors,
    chartMin: minMagnitude - CHART_PADDING,
    chartMax: maxMagnitude + CHART_PADDING,
    chartMinMjd: minMjd - leftTimePadding,
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
  const { magnitudePoints, pointColors, errors, chartMin, chartMax, chartMinMjd } = chartData.value
  lightCurveChart.data.datasets[0].data = magnitudePoints
  lightCurveChart.data.datasets[0].borderColor = pointColors
  lightCurveChart.data.datasets[0].backgroundColor = pointColors
  lightCurveChart.options.scales.x.min = chartMinMjd
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
  const secondary = style.getPropertyValue('--secondary-interactive')
  const background = style.getPropertyValue('--secondary-background')
  const info = style.getPropertyValue('--info')

  const { magnitudePoints, pointColors, errors, chartMin, chartMax, chartMinMjd } = chartData.value
  if (!magnitudePoints.length) return

  lightCurveChart = new Chart(lightCurveCanvas.value, {
    type: 'scatter',
    plugins: [errorBarPlugin],
    data: {
      datasets: [
        { // Main magnitude dataset is a line chart
          label: 'Magnitude',
          data: magnitudePoints,
          order: 0,
          showLine: false,
          borderColor: pointColors,
          borderWidth: 2,
          borderJoinStyle: 'round',
          backgroundColor: pointColors,
          cubicInterpolationMode: 'monotone',
          tension: 0.4,
          pointHoverBorderColor: secondary,
          pointHoverBackgroundColor: secondary,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: chartMinMjd,
          title: { display: true, text: 'Modified Julian Date (days since first observation)', color: text },
          border: { color: text, width: 2 },
          ticks: {
            color: text,
            maxTicksLimit: 8,
            callback: (value) => [
              formatMjd(value),
              formatDayOffset(value - chartData.value.baseMjd),
            ],
          },
          grid: { color: background, tickColor: text},
        },
        y: {
          min: chartMin,
          max: chartMax,
          title: { display: true, text: 'Magnitude', color: text },
          border: { color: text, width: 2 },
          ticks: { color: text, stepSize: MAGNITUDE_TICK_STEP },
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
            title: (contexts) => {
              const point = chartData.value.magnitudePoints[contexts[0]?.dataIndex]
              return `MJD ${formatMjd(point.x)} (${formatDayOffset(point.dayOffset)})`
            },
            label: (context) => {
              const error = chartData.value.errors[context.dataIndex]
              const point = chartData.value.magnitudePoints[context.dataIndex]
              const mag = Number(context.parsed.y).toFixed(DECIMAL_PLACES)
              const telescope =  `${point.telescopeSize}`
              if (!error) return `Magnitude: ${mag}${telescope}`
              const magError = Math.abs(error[1] - error[0]) / 2
              return `Magnitude: ${mag} +/- ${magError.toFixed(DECIMAL_PLACES)}${telescope}`
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

function toggleTelescope(telescopeSize) {
  const nextHiddenTelescopeSizes = new Set(hiddenTelescopeSizes.value)
  if (nextHiddenTelescopeSizes.has(telescopeSize)) {
    nextHiddenTelescopeSizes.delete(telescopeSize)
  } else {
    nextHiddenTelescopeSizes.add(telescopeSize)
  }
  hiddenTelescopeSizes.value = nextHiddenTelescopeSizes
  if (lightCurveChart) updateChart()
}

onMounted(() => {
  createChart()
})

</script>
<template>
  <div class="wrapper">
    <div class="title-lc">
      <div class="title-heading">
        <input
          v-if="isEditingTitle"
          ref="titleInput"
          v-model="userTitle"
          class="title-input"
          aria-label="Light curve title"
          placeholder="Add a Title"
          @blur="stopEditingTitle"
          @keyup.enter="stopEditingTitle"
          @keyup.esc="stopEditingTitle"
        >
        <button
          v-else
          type="button"
          class="title-edit-trigger"
          @click="startEditingTitle"
        >
          <span>{{ chartTitle }}</span>
          <v-icon
            icon="mdi-pencil"
            size="18"
          />
        </button>
        <span>- Light Curve</span>
      </div>
      <span
        v-for="line in chartSubtitleText"
        :key="line"
        class="subtitle-lc"
      >
        {{ line }}
      </span>
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(lightCurveChart, 'light-curve.png', downloadTitle, { preserveDatasetColors: true })"
      />
    </div>
    <div class="light-curve-plot-wrapper">
      <canvas
        ref="lightCurveCanvas"
        class="light-curve-plot"
      />
      <div class="telescope-legend">
        <button
          v-for="item in telescopeLegendItems"
          :key="item.key"
          type="button"
          class="telescope-legend-item"
          :class="{ 'telescope-legend-item-hidden': item.hidden }"
          @click="toggleTelescope(item.key)"
        >
          <span
            class="telescope-legend-swatch"
            :style="{ backgroundColor: item.color }"
          />
          <span class="telescope-legend-label">{{ item.label }}</span>
        </button>
      </div>
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
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin: 0 0 1rem;
  position: relative;
  text-align: center;
}
.title-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: var(--text);
  flex-wrap: wrap;
}
.title-edit-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  padding: 0;
}
.title-input {
  width: min(280px, 64vw);
  border: 1px solid var(--secondary-background);
  border-radius: 4px;
  background: var(--primary-background);
  color: var(--text);
  font: inherit;
  padding: 0.2rem 0.45rem;
  text-align: center;
}
.subtitle-lc {
  color: var(--text);
  font-size: 0.95rem;
  line-height: 1.2;
}
.light-curve-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}
.light-curve-plot {
  flex: 1 1 auto;
  min-width: 0;
  width: 100% !important;
  height: 100% !important;
}
.telescope-legend {
  flex: 0 0 150px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.75rem;
}
.telescope-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  padding: 0.2rem 0;
  text-align: left;
}
.telescope-legend-swatch {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
}
.telescope-legend-item-hidden .telescope-legend-label {
  text-decoration: line-through;
}
.telescope-legend-item-hidden .telescope-legend-swatch {
  opacity: 0.45;
}
.download-btn {
  position: absolute;
  left: calc(100% + 0.75rem);
  top: 0;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}

@media (max-width: 760px) {
  .light-curve-plot-wrapper {
    flex-direction: column;
  }
  .telescope-legend {
    flex: 0 0 auto;
    flex-direction: row;
    flex-wrap: wrap;
    padding-top: 0;
  }
}
</style>
