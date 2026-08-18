/*
  Shared helpers for the cluster-analysis chart components (HRDiagramPlot,
  ProperMotionPlot, ParallaxHistogram, DistanceHistogram).
*/

// dimmed grey for field (non-member) stars and out-of-window histogram bars
export const DIMMED_COLOR = 'rgba(128, 138, 148, 0.45)'

// Chart.js can't read CSS custom properties, so resolve the theme vars to strings once
export function getThemeColors() {
  const style = getComputedStyle(document.body)
  return {
    text: style.getPropertyValue('--text'),
    primary: style.getPropertyValue('--primary-interactive'),
    secondary: style.getPropertyValue('--secondary-interactive'),
    background: style.getPropertyValue('--secondary-background')
  }
}

/*
  Decompose the input HR diagram output into separate arrays for color, radii, shape,
  and hitRadii for use in chartjs charts. This is meant to be fed in as a single dataset
  with these arrays controlling some of the displayable styles of the dataset.
  We do this to keep the length of the dataset constant as stars are selected/deselected in
  the chart, because otherwise the chart points would flicker during selection.
*/
export function createStarPointStyles(points, { memberFlags, themeColors, isVisible = null }) {
  const memberCount = memberFlags ? points.filter((point) => memberFlags[point.cmdIndex]).length : points.length
  // smaller points keep a dense cluster field readable
  const memberRadius = memberCount > 1000 ? 2 : 3
  const colors = []
  const radii = []
  const shapes = []
  const hitRadii = []
  for (const point of points) {
    const member = !memberFlags || memberFlags[point.cmdIndex]
    const visible = !isVisible || isVisible(point)
    colors.push(member ? themeColors.primary : DIMMED_COLOR)
    radii.push(visible ? (member ? memberRadius : 2) : 0)
    hitRadii.push(visible ? 1 : 0)
    shapes.push(point.star.gaia_only ? 'triangle' : 'circle')
  }
  return { colors, radii, shapes, hitRadii }
}

/*
  This is called as star selection / membership changes - it updates the properties of the
  star points in place without triggering a chart.update() which takes a long time. This is
  fine as long as we don't change the whole dataset, which only happens when loading a new dataset.

  Returns false if the data in the chart doesn't match the length of the star point styles passed in.
*/
export function restyleStarPoints(chart, { colors, radii, shapes, hitRadii }) {
  const elements = chart.getDatasetMeta(0).data
  if (elements.length !== colors.length) return false

  const dataset = chart.data.datasets[0]
  dataset.pointBackgroundColor = colors
  dataset.pointBorderColor = colors
  dataset.pointRadius = radii
  dataset.pointHitRadius = hitRadii
  dataset.pointStyle = shapes

  for (let index = 0; index < elements.length; index++) {
    const options = elements[index].options
    options.backgroundColor = colors[index]
    options.borderColor = colors[index]
    options.radius = radii[index]
    options.hitRadius = hitRadii[index]
    options.pointStyle = shapes[index]
  }
  // redraws the plots (which is very quick compared to updating them)
  chart.render()
  return true
}
