/*
  Downloads a chart as the screen shows it. Every plot is styled from the app's theme
  variables. It adds the title (which lives in the DOM next to the canvas, not in
  the chart), turns tooltips off, and composites the canvas onto the page background. The
  canvas itself is transparent, so it is given a background to match the theme of the app
  so text remains legible.
*/

export async function downloadChartAsPNG(chart, filename, titleText, options = {}) {
  const { legendItems = [] } = options
  // the plots sit directly on the analysis page, whose background this is
  const themeStyles = getComputedStyle(document.body)
  const backgroundColor = themeStyles.getPropertyValue('--primary-background').trim() || '#192026'
  const textColor = themeStyles.getPropertyValue('--text').trim() || '#fcfcfc'
  const originalTitle = chart.options.plugins?.title
  const originalSubtitle = chart.options.plugins?.subtitle
  const originalTooltip = chart.options.plugins?.tooltip

  if (chart.options.plugins) chart.options.plugins.tooltip = { enabled: false }
  // Any lines after the first (the light curve sends source and aperture details) become the
  // subtitle, small like the page shows them, so they don't eat into the plot's space
  const [heading, ...subtitleLines] = Array.isArray(titleText) ? titleText : [titleText]
  chart.options.plugins.title = {
    display: true,
    text: heading,
    color: textColor,
    font: { size: 20 },
    padding: subtitleLines.length ? { top: 10, bottom: 2 } : 10
  }
  chart.options.plugins.subtitle = {
    display: subtitleLines.length > 0,
    text: subtitleLines,
    color: textColor,
    font: { size: 13 },
    padding: { top: 0, bottom: 10 }
  }

  chart.update('none')

  // Wait for the chart to finish rendering
  await new Promise(resolve => setTimeout(resolve, 100))

  // Export as PNG: page background, then the chart canvas, then any hand-drawn legend
  const scale = chart.currentDevicePixelRatio || 1
  const legendWidth = legendItems.length ? 190 * scale : 0
  const exportCanvas = document.createElement('canvas')
  const ctx = exportCanvas.getContext('2d')

  exportCanvas.width = chart.canvas.width + legendWidth
  exportCanvas.height = chart.canvas.height
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.drawImage(chart.canvas, 0, 0)

  if (legendItems.length) {
    const legendX = chart.canvas.width + 24 * scale
    const legendY = chart.chartArea.top * scale
    ctx.font = `${16 * scale}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = textColor

    legendItems.forEach((item, index) => {
      const y = legendY + index * 26 * scale
      ctx.fillStyle = item.color
      ctx.fillRect(legendX, y - 6 * scale, 12 * scale, 12 * scale)
      ctx.fillStyle = textColor
      ctx.fillText(item.label, legendX + 20 * scale, y)
      if (item.hidden) {
        const textWidth = ctx.measureText(item.label).width
        ctx.beginPath()
        ctx.moveTo(legendX + 20 * scale, y)
        ctx.lineTo(legendX + 20 * scale + textWidth, y)
        ctx.stroke()
      }
    })
  }

  const pngUrl = exportCanvas.toDataURL('image/png', 1)
  const a = document.createElement('a')
  a.href = pngUrl
  a.download = filename
  a.click()

  // Put the chart back the way the page had it
  if (chart.options.plugins) {
    chart.options.plugins.title = originalTitle
    chart.options.plugins.subtitle = originalSubtitle
    chart.options.plugins.tooltip = originalTooltip
  }
  chart.update('none')
}
