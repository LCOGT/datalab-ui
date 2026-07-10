export async function downloadChartAsPNG(chart, filename, titleText, options = {}) {
  const { preserveDatasetColors = false } = options
  const originalTitle = chart.options.plugins?.title
  const originalTooltip = chart.options.plugins?.tooltip
  const originalLegendLabelColor = chart.options.plugins?.legend?.labels?.color
  const originalScaleStyles = {}
  const originalDatasets = chart.data.datasets.map(ds => ({ ...ds }))

  if (!preserveDatasetColors) {
    chart.data.datasets.forEach(ds => {
      ds.borderColor = '#000'
      ds.backgroundColor = '#000'
    })
  }

  // Set all option colors to black, background to transparent
  if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = '#000'
  if (chart.options.plugins) chart.options.plugins.tooltip = { enabled: false }
  if (chart.options.scales) {
    Object.entries(chart.options.scales).forEach(([scaleId, scale]) => {
      originalScaleStyles[scaleId] = {
        ticksColor: scale.ticks?.color,
        titleColor: scale.title?.color,
        gridColor: scale.grid?.color,
        borderColor: scale.border?.color,
      }
      if (scale.ticks) scale.ticks.color = '#000'
      if (scale.title) scale.title.color = '#000'
      if (scale.grid) scale.grid.color = '#000'
      if (scale.border) scale.border.color = '#000'
    })
  }

  chart.options.plugins.title = {
    display: true,
    text: titleText,
    color: '#000',
    font: { size: 20 }
  }

  chart.update('none')

  // Wait for the chart to finish rendering
  await new Promise(resolve => setTimeout(resolve, 100))

  // Export as PNG
  const pngUrl = chart.toBase64Image('image/png', 1)
  const a = document.createElement('a')
  a.href = pngUrl
  a.download = filename
  a.click()

  // Restore original colors
  if (chart.options.plugins) {
    chart.options.plugins.title = originalTitle
    chart.options.plugins.tooltip = originalTooltip
    if (chart.options.plugins.legend?.labels) {
      chart.options.plugins.legend.labels.color = originalLegendLabelColor
    }
  }
  if (chart.options.scales) {
    Object.entries(chart.options.scales).forEach(([scaleId, scale]) => {
      const originalStyle = originalScaleStyles[scaleId]
      if (!originalStyle) return
      if (scale.ticks) scale.ticks.color = originalStyle.ticksColor
      if (scale.title) scale.title.color = originalStyle.titleColor
      if (scale.grid) scale.grid.color = originalStyle.gridColor
      if (scale.border) scale.border.color = originalStyle.borderColor
    })
  }
  chart.data.datasets = originalDatasets
  chart.update('none')
}
