export async function downloadChartAsPNG(chart, filename, titleText) {
  // Deep clone original options and datasets
  const originalOptions = JSON.parse(JSON.stringify(chart.options))
  const originalDatasets = chart.data.datasets.map(ds => ({ ...ds }))
  chart.data.datasets.forEach(ds => {
    ds.borderColor = '#000'
    ds.backgroundColor = '#000'
  })

  // Set all option colors to black, background to transparent
  if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = '#000'
  if (chart.options.plugins) chart.options.plugins.tooltip = { enabled: false }
  if (chart.options.scales) {
    Object.values(chart.options.scales).forEach(scale => {
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
  chart.options = originalOptions
  chart.data.datasets = originalDatasets
  chart.update('none')
}
