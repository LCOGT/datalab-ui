const APERTURE_RING_KEYS = ['radius', 'r_back1', 'r_back2']

function imagePointDistance(firstPoint, secondPoint) {
  const deltaX = secondPoint.lng - firstPoint.lng
  const deltaY = secondPoint.lat - firstPoint.lat
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
}

function maximumRadiusAtImagePoint(center, imageDimensions) {
  return Math.min(
    center.lng,
    center.lat,
    imageDimensions.width - center.lng,
    imageDimensions.height - center.lat,
  )
}

function createApertureRadii(rawRadius, defaults, minimumRadius) {
  const radius = Math.max(rawRadius, minimumRadius)
  return {
    radius,
    r_back1: radius * (defaults.r_back1 / defaults.radius),
    r_back2: radius * (defaults.r_back2 / defaults.radius),
  }
}

function constrainApertureRadii(radii, maximumOuterRadius) {
  const radiusScale = Math.min(1, maximumOuterRadius / radii.r_back2)
  return {
    radius: radii.radius * radiusScale,
    r_back1: radii.r_back1 * radiusScale,
    r_back2: radii.r_back2 * radiusScale,
  }
}

function apertureRingAtPoint(region, point, tolerance) {
  const center = { lng: region.x, lat: region.y }
  const distance = imagePointDistance(center, point)
  const closestRing = APERTURE_RING_KEYS.reduce((closestKey, ringKey) => {
    const closestDistance = Math.abs(distance - region[closestKey])
    const ringDistance = Math.abs(distance - region[ringKey])
    return ringDistance < closestDistance ? ringKey : closestKey
  })
  return Math.abs(distance - region[closestRing]) < tolerance ? closestRing : null
}

function resizeApertureRegion(region, ringKey, point, imageDimensions) {
  const center = { lng: region.x, lat: region.y }
  const radius = imagePointDistance(center, point)
  const maximumOuterRadius = maximumRadiusAtImagePoint(center, imageDimensions)
  const resizedRegion = { ...region }

  if (ringKey === 'radius') {
    resizedRegion.radius = Math.min(radius, resizedRegion.r_back1 - 1)
  } else if (ringKey === 'r_back1') {
    resizedRegion.r_back1 = Math.max(radius, resizedRegion.radius + 1)
    resizedRegion.r_back1 = Math.min(resizedRegion.r_back1, resizedRegion.r_back2 - 1)
  } else {
    resizedRegion.r_back2 = Math.min(
      Math.max(radius, resizedRegion.r_back1 + 1),
      maximumOuterRadius,
    )
  }

  return resizedRegion
}

export {
  apertureRingAtPoint,
  constrainApertureRadii,
  createApertureRadii,
  imagePointDistance,
  maximumRadiusAtImagePoint,
  resizeApertureRegion,
}
