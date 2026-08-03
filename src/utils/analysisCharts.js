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
  Per-point color / radius / shape / hit-radius arrays for a star scatter, styled by
  membership. Every star stays in ONE dataset with these indexable options rather than being
  split into member/field datasets: re-partitioning changes each dataset's element count on
  every drag frame, and Chart.js destroying/recreating point elements mid-drag makes stars
  blink. Members take the primary color and field stars are dimmed; Gaia-only stars are
  triangles, image stars circles. Points where isVisible(point) is false are hidden (radius and
  hit radius zeroed) rather than removed, so the element count stays stable.

  points: [{ cmdIndex, star }, ...]; memberFlags aligned by cmdIndex (null = all members).
*/
export function starPointStyles(points, { memberFlags, themeColors, isVisible = null }) {
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
