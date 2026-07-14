<script setup>
import Chart from 'chart.js/auto'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { downloadChartAsPNG } from '@/utils/downloadChart.js'
import { getThemeColors, DIMMED_COLOR, starPointStyles } from '@/utils/analysisCharts.js'

/*
  Color-Magnitude Diagram (observational HR diagram) of a star cluster.
  A true numeric x/y scatter: x = blue - red color, y = red band magnitude (reversed,
  brighter stars up). A small inline plugin draws error bars only when the star count
  is low enough for them to be readable.

  The isochrone overlay (the fitted model, placed by DataAnalysisView) is a
  line-style dataset drawn on top of the stars.
*/

const props = defineProps({
  cmdData: {
    type: Object,
    required: true
  },
  // per-star member flags aligned with cmdData.cmd, or null when no membership selection is active
  memberFlags: {
    type: Array,
    default: null
  },
  // placed isochrone polyline [{x, y}, ...] in observed CMD coordinates, or null when unavailable
  isochrone: {
    type: Array,
    default: null
  },
  // whether the isochrone is drawn: v-model'ed so the legend chip here and the
  // show-switch in IsochroneControls toggle the same state
  isochroneVisible: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:isochroneVisible'])

const hrDiagramCanvas = ref(null)
let hrDiagramChart = null
let themeColors = {}

// beyond this many stars, per-point error bars are unreadable; errors stay in the tooltip though
const ERROR_BAR_MAX_POINTS = 300
const AXIS_PADDING = 0.3

// the legend entries act as toggle chips for these rendering filters. Hidden
// points keep their chart elements (radius and hit radius zeroed) instead of
// being filtered out of the data: element counts must stay stable while the
// membership selection drags, or points flicker (see pointStyles)
const hiddenCategories = reactive({ members: false, field: false, gaiaOnly: false })

// point objects depend only on the cmd data, never on the membership selection, so
// their identity is stable while the selection is dragged (cmdIndex keys the star
// back into memberFlags). Gaia-only stars plot too when they carry synthetic
// photometry; those without any color/mag live on the membership plots only
const points = computed(() => {
  const cmd = props.cmdData.cmd || []
  const plottable = []
  cmd.forEach((star, index) => {
    if (Number.isFinite(star.color) && Number.isFinite(star.mag)) {
      plottable.push({ x: star.color, y: star.mag, star: star, cmdIndex: index })
    }
  })
  return plottable
})

const axisTitles = computed(() => {
  const blue = props.cmdData.blue_filter || 'blue'
  const red = props.cmdData.red_filter || 'red'
  return {
    x: `${blue} - ${red} (color)`,
    y: `${props.cmdData.mag_band || red} (magnitude)`
  }
})

const chartTitle = computed(() => {
  const clusterName = props.cmdData.cluster?.name
  const flags = props.memberFlags
  const starCount = points.value.length
  const memberCount = flags ? points.value.filter((point) => flags[point.cmdIndex]).length : null
  const countText = memberCount === null ? `${starCount} stars` : `${memberCount} of ${starCount} members`
  return (clusterName ? `${clusterName}: ` : '') + `Color-Magnitude Diagram (${countText})`
})

const hasGaiaOnlyPoints = computed(() => points.value.some((point) => point.star.gaia_only))

function pointVisible(point) {
  if (point.star.gaia_only && hiddenCategories.gaiaOnly) return false
  const flags = props.memberFlags
  if (flags) {
    // with a membership selection active, each point answers to its own chip:
    // members to the 'Members' toggle, non-members to the 'Field stars' toggle
    return flags[point.cmdIndex] ? !hiddenCategories.members : !hiddenCategories.field
  }
  // no membership selection: the 'Stars' chip covers the image stars, and
  // Gaia-only points answer to the 'Gaia catalog' chip alone
  return point.star.gaia_only || !hiddenCategories.members
}

// hidden categories (legend toggles) zero a point's radius + hit radius instead of removing it
function pointStyles() {
  return starPointStyles(points.value, { memberFlags: props.memberFlags, themeColors, isVisible: pointVisible })
}

function buildStarDataset() {
  const { colors, radii, shapes, hitRadii } = pointStyles()
  return {
    label: 'Stars',
    data: points.value,
    parsing: false,
    pointBackgroundColor: colors,
    pointBorderColor: colors,
    pointRadius: radii,
    pointHitRadius: hitRadii,
    pointStyle: shapes,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: themeColors.secondary,
    pointHoverBorderColor: themeColors.secondary
  }
}

function buildIsochroneDataset() {
  return {
    label: 'Isochrone',
    type: 'line',
    data: props.isochrone,
    parsing: false,
    borderColor: themeColors.secondary,
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    // radius 0 alone still leaves points hoverable; keep the polyline out of
    // tooltips entirely so nearby stars stay easy to inspect
    pointHitRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    // chart.js draws the lowest order last, putting the model line on top of the stars
    order: -1
  }
}

// restyle the existing datasets in place - replacing them would recreate the chart elements
function syncDatasets(datasets) {
  const { colors, radii, shapes, hitRadii } = pointStyles()
  const starDataset = datasets[0]
  starDataset.data = points.value
  starDataset.pointBackgroundColor = colors
  starDataset.pointBorderColor = colors
  starDataset.pointRadius = radii
  starDataset.pointHitRadius = hitRadii
  starDataset.pointStyle = shapes
  const showIsochrone = props.isochrone && props.isochrone.length && props.isochroneVisible
  if (showIsochrone && datasets.length > 1) {
    datasets[1].data = props.isochrone
  } else if (showIsochrone) {
    datasets.push(buildIsochroneDataset())
  } else if (datasets.length > 1) {
    datasets.splice(1)
  }
}

// legend entries are generated by hand (the member/field split is per-point
// color, not per-dataset) and double as toggle chips: each carries the category
// it flips, and toggled-off entries render struck through
function legendLabels() {
  const entries = []
  if (props.memberFlags) {
    entries.push({ text: 'Members', category: 'members', hidden: hiddenCategories.members, fillStyle: themeColors.primary, strokeStyle: themeColors.primary, pointStyle: 'circle', fontColor: themeColors.text })
    entries.push({ text: 'Field stars', category: 'field', hidden: hiddenCategories.field, fillStyle: DIMMED_COLOR, strokeStyle: DIMMED_COLOR, pointStyle: 'circle', fontColor: themeColors.text })
  } else {
    entries.push({ text: 'Stars', category: 'members', hidden: hiddenCategories.members, fillStyle: themeColors.primary, strokeStyle: themeColors.primary, pointStyle: 'circle', fontColor: themeColors.text })
  }
  if (hasGaiaOnlyPoints.value) {
    entries.push({ text: 'Gaia catalog', category: 'gaiaOnly', hidden: hiddenCategories.gaiaOnly, fillStyle: themeColors.primary, strokeStyle: themeColors.primary, pointStyle: 'triangle', fontColor: themeColors.text })
  }
  if (props.isochrone && props.isochrone.length) {
    entries.push({ text: 'Isochrone', category: 'isochrone', hidden: !props.isochroneVisible, fillStyle: 'transparent', strokeStyle: themeColors.secondary, lineWidth: 2, pointStyle: 'line', fontColor: themeColors.text })
  }
  return entries
}

function toggleLegendCategory(event, legendItem) {
  if (legendItem.category === 'isochrone') {
    // owned by the parent so the IsochroneControls show-switch stays in sync
    emit('update:isochroneVisible', !props.isochroneVisible)
  } else if (legendItem.category) {
    hiddenCategories[legendItem.category] = !hiddenCategories[legendItem.category]
    updateChart()
  }
}

// draws x/y error bars for the member stars, in their point color so PNG download stays consistent
const errorBarPlugin = {
  id: 'cmdErrorBars',
  afterDatasetsDraw(chart) {
    const starPoints = chart.data.datasets[0]?.data || []
    const flags = props.memberFlags
    const memberPoints = starPoints.filter((point) => (!flags || flags[point.cmdIndex]) && pointVisible(point))
    if (!memberPoints.length || memberPoints.length > ERROR_BAR_MAX_POINTS) return

    const { ctx } = chart
    const xScale = chart.scales.x
    const yScale = chart.scales.y
    ctx.save()
    ctx.strokeStyle = themeColors.primary
    ctx.lineWidth = 1
    for (const point of memberPoints) {
      const star = point.star
      if (!star) continue
      const pixelX = xScale.getPixelForValue(point.x)
      const pixelY = yScale.getPixelForValue(point.y)
      if (star.color_err) {
        ctx.beginPath()
        ctx.moveTo(xScale.getPixelForValue(point.x - star.color_err), pixelY)
        ctx.lineTo(xScale.getPixelForValue(point.x + star.color_err), pixelY)
        ctx.stroke()
      }
      if (star.magerr) {
        ctx.beginPath()
        ctx.moveTo(pixelX, yScale.getPixelForValue(point.y - star.magerr))
        ctx.lineTo(pixelX, yScale.getPixelForValue(point.y + star.magerr))
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}

// both axes are pinned to the stars only: letting chart.js auto-scale over the
// isochrone dataset would rescale/pan the whole plot on every fit-slider tick,
// since the polyline extends far beyond the data (by design). Pinned bounds keep
// every star in view and let the model line clip at the chart edges instead
function axisBounds() {
  const plotted = points.value
  if (!plotted.length) return null
  let minColor = Infinity
  let maxColor = -Infinity
  let minMag = Infinity
  let maxMag = -Infinity
  for (const point of plotted) {
    if (point.x < minColor) minColor = point.x
    if (point.x > maxColor) maxColor = point.x
    if (point.y < minMag) minMag = point.y
    if (point.y > maxMag) maxMag = point.y
  }
  const colorPad = Math.max(0.1, 0.05 * (maxColor - minColor))
  const magPad = Math.max(AXIS_PADDING, 0.05 * (maxMag - minMag))
  return {
    x: { min: minColor - colorPad, max: maxColor + colorPad },
    y: { min: minMag - magPad, max: maxMag + magPad }
  }
}

function showLegend() {
  // anything beyond a lone always-on 'Stars' chip is worth showing/toggling
  return !!props.memberFlags || hasGaiaOnlyPoints.value || !!(props.isochrone && props.isochrone.length)
}

function tooltipLines(context) {
  const star = context.raw?.star
  if (!star) return []
  const lines = [
    `color: ${star.color} ± ${star.color_err}`,
    `${props.cmdData.mag_band || 'mag'}: ${star.mag} ± ${star.magerr}`,
    `ra, dec: ${star.ra}, ${star.dec}`
  ]
  if (star.gaia_only) {
    lines.unshift(`Gaia catalog star (G = ${star.g_mag}, synthetic photometry)`)
  }
  if (star.gaia_match) {
    lines.push(`pm: ${star.pmra}, ${star.pmdec} mas/yr | parallax: ${star.parallax} mas`)
  }
  // Bailer-Jones geometric distance with its 16th-84th percentile range, when the source has one
  if (star.distance != null) {
    lines.push(`distance: ${Math.round(star.distance)} pc (${Math.round(star.distance_lo)}–${Math.round(star.distance_hi)})`)
  }
  return lines
}

function updateChart() {
  const bounds = axisBounds()
  syncDatasets(hrDiagramChart.data.datasets)
  hrDiagramChart.options.scales.x.min = bounds?.x.min
  hrDiagramChart.options.scales.x.max = bounds?.x.max
  hrDiagramChart.options.scales.y.min = bounds?.y.min
  hrDiagramChart.options.scales.y.max = bounds?.y.max
  hrDiagramChart.options.plugins.legend.display = showLegend()
  hrDiagramChart.update()
}

function createChart() {
  themeColors = getThemeColors()

  const bounds = axisBounds()

  const datasets = [buildStarDataset()]
  if (props.isochrone && props.isochrone.length && props.isochroneVisible) {
    datasets.push(buildIsochroneDataset())
  }
  hrDiagramChart = new Chart(hrDiagramCanvas.value, {
    type: 'scatter',
    data: {
      datasets: datasets
    },
    plugins: [errorBarPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: true },
      scales: {
        x: {
          type: 'linear',
          min: bounds?.x.min,
          max: bounds?.x.max,
          title: { display: true, text: axisTitles.value.x, color: themeColors.text },
          border: { color: themeColors.text, width: 2 },
          ticks: { color: themeColors.text },
          grid: { color: themeColors.background, tickColor: themeColors.text }
        },
        y: {
          min: bounds?.y.min,
          max: bounds?.y.max,
          // brighter stars have smaller magnitudes and belong at the top
          reverse: true,
          title: { display: true, text: axisTitles.value.y, color: themeColors.text },
          border: { color: themeColors.text, width: 2 },
          ticks: { color: themeColors.text },
          grid: { color: themeColors.background, tickColor: themeColors.text }
        }
      },
      plugins: {
        legend: {
          display: showLegend(),
          // chart.js' default click handler hides whole datasets, which the
          // single shared star dataset can't support; ours toggles categories
          onClick: toggleLegendCategory,
          onHover: (event) => { event.native.target.style.cursor = 'pointer' },
          onLeave: (event) => { event.native.target.style.cursor = 'default' },
          labels: { color: themeColors.text, usePointStyle: true, generateLabels: legendLabels }
        },
        tooltip: {
          callbacks: {
            label: tooltipLines
          }
        }
      }
    }
  })
}

// a new operation output is a fresh plot: clear the legend toggles
watch(() => props.cmdData, () => {
  Object.assign(hiddenCategories, { members: false, field: false, gaiaOnly: false })
})

watch(() => [props.cmdData, props.memberFlags, props.isochrone, props.isochroneVisible], () => {
  if (hrDiagramChart && props.cmdData.cmd) {
    updateChart()
  } else if (hrDiagramCanvas.value) {
    createChart()
  }
}, { deep: true })

onMounted(() => {
  createChart()
})

</script>
<template>
  <div class="wrapper">
    <p class="title-cmd">
      {{ chartTitle }}
      <v-btn
        icon="mdi-download"
        class="download-btn"
        title="Download as PNG"
        @click="downloadChartAsPNG(hrDiagramChart, 'hr-diagram.png', chartTitle)"
      />
    </p>
    <div class="hr-diagram-plot-wrapper">
      <canvas
        ref="hrDiagramCanvas"
        class="hr-diagram-plot"
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
.title-cmd {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1rem;
}
.hr-diagram-plot-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
}
.hr-diagram-plot {
  width: 100% !important;
  height: 100% !important;
}
.download-btn {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
}
</style>
