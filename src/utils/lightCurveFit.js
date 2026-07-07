// LOESS (locally weighted regression) fit for light-curve trend overlays.
//
// A single global polynomial is a poor model for light curves: high enough order to
// trace real features rings at the endpoints (Runge phenomenon), and the basis assumes
// a shape the data may not have. LOESS instead fits each output point from only a local
// window of nearby observations, so the curve adapts to arbitrary shapes (periodic
// stars or one-shot transients) without ringing, weights by measurement error, and
// resists outliers via robustness iterations.

// Number of points sampled along the output trend line (for a smooth polyline).
const LOESS_SAMPLE_COUNT = 120
// Fraction of points in each local window; the smoothness knob (smaller = more detail).
const LOESS_SPAN = 0.3
// Local polynomial degree. Degree 1 (local linear) is used deliberately: a local
// quadratic overshoots at the endpoints, reintroducing the ringing this replaces.
const LOESS_DEGREE = 1
// Number of robustness (outlier down-weighting) passes.
const LOESS_ROBUST_ITERS = 2
// Cleveland's robustness envelope: residuals beyond this many median deviations
// (measured in error bars) are treated as outliers and fully down-weighted.
const LOESS_ROBUST_TUNING = 6

/*
  Fits the light-curve points with LOESS to produce a smooth trend overlay.

  For every sampled x we:
    1. take the nearest LOESS_SPAN fraction of points as the window,
    2. weight them by a tricube function of distance (near points dominate),
    3. multiply in a measurement weight of 1/magerr^2 (precise points dominate),
    4. fit a low-degree polynomial centered on x, so the value at x is its intercept.
  A couple of robustness passes then down-weight outliers by how many error bars they
  sit from the local fit.

  x is normalized to [0, 1] over the visible date range before fitting for numerical
  stability; the returned x values are still real dates. Returns [{ x, y }], or [] when
  there are too few valid points to fit.
*/
export function loessPoints(dateValues, magnitudes, magerrs, minDate, maxDate) {
  const points = dateValues
    .map((date, index) => ({ date, magnitude: magnitudes[index], magerr: magerrs[index] }))
    .filter(point => Number.isFinite(point.date) && Number.isFinite(point.magnitude))

  if (points.length < 2 || !Number.isFinite(minDate) || !Number.isFinite(maxDate)) {
    return []
  }

  const xSpan = maxDate - minDate || 1
  const validErrors = points
    .map(point => point.magerr)
    .filter(magerr => Number.isFinite(magerr) && magerr > 0)
  // Points with no usable error are treated as median precision rather than ignored:
  // a flat weight of 1 would be negligible next to real 1/sigma^2 weights (often
  // thousands), effectively dropping those points from the fit.
  const fallbackSigma = validErrors.length ? median(validErrors) : 1
  const normalizedPoints = points.map(point => {
    const sigma = Number.isFinite(point.magerr) && point.magerr > 0 ? point.magerr : fallbackSigma
    return {
      x: (point.date - minDate) / xSpan,
      y: point.magnitude,
      sigma,
      // Inverse-variance weighting: precise measurements count more.
      weight: 1 / (sigma * sigma)
    }
  })

  const robustnessWeights = loessRobustnessWeights(normalizedPoints)

  const sampleCount = Math.max(LOESS_SAMPLE_COUNT, magnitudes.length)
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const normalizedX = sampleCount === 1 ? 0 : sampleIndex / (sampleCount - 1)
    return {
      x: minDate + (normalizedX * xSpan),
      y: localRegression(normalizedPoints, robustnessWeights, normalizedX)
    }
  })
}

/*
  Runs the robust LOWESS iterations: fit at each observation, then down-weight points
  with large residuals using a bisquare function and refit. Returns one robustness
  weight per observation, applied on top of the tricube/measurement weights.

  Residuals are studentized (divided by the point's error bar) before the bisquare, so
  outliers are judged by how many error bars they sit from the local fit: a noisy point
  is treated leniently, a precise-but-discrepant point strictly. The median scale keeps
  this adaptive even when the reported error bars are systematically mis-calibrated.
*/
function loessRobustnessWeights(points) {
  let robustnessWeights = new Array(points.length).fill(1)

  for (let iteration = 0; iteration < LOESS_ROBUST_ITERS; iteration++) {
    const studentizedResiduals = points.map((point) =>
      Math.abs(point.y - localRegression(points, robustnessWeights, point.x)) / point.sigma)
    const medianResidual = median(studentizedResiduals)
    if (!(medianResidual > 0)) break // exact or degenerate fit; nothing to down-weight

    robustnessWeights = studentizedResiduals.map(residual => {
      const scaled = residual / (LOESS_ROBUST_TUNING * medianResidual)
      return scaled >= 1 ? 0 : Math.pow(1 - scaled * scaled, 2)
    })
  }

  return robustnessWeights
}

/*
  Estimates the smoothed magnitude at evalX from a local weighted polynomial fit.
  Because the local polynomial is fitted in the coordinate (x - evalX), its value at
  evalX is simply the intercept, so we only need the first coefficient.
*/
function localRegression(points, robustnessWeights, evalX) {
  const pointCount = points.length
  const windowSize = Math.min(pointCount, Math.max(LOESS_DEGREE + 1, Math.ceil(LOESS_SPAN * pointCount)))
  const distances = points.map(point => Math.abs(point.x - evalX))
  const bandwidth = [...distances].sort((a, b) => a - b)[windowSize - 1] || Number.EPSILON

  const samples = []
  for (let index = 0; index < pointCount; index++) {
    if (distances[index] > bandwidth) continue
    const tricube = Math.pow(1 - Math.pow(distances[index] / bandwidth, 3), 3)
    const weight = tricube * points[index].weight * robustnessWeights[index]
    if (weight <= 0) continue
    samples.push({ x: points[index].x - evalX, y: points[index].y, weight })
  }

  if (!samples.length) return nearestMagnitude(points, distances)

  // Drop the degree when the window has too few points to support LOESS_DEGREE.
  const localDegree = Math.min(LOESS_DEGREE, samples.length - 1)
  const coefficients = weightedPolyFit(samples, localDegree)
  if (!coefficients) return nearestMagnitude(points, distances)

  return coefficients[0]
}

function nearestMagnitude(points, distances) {
  let nearestIndex = 0
  for (let index = 1; index < distances.length; index++) {
    if (distances[index] < distances[nearestIndex]) nearestIndex = index
  }
  return points[nearestIndex].y
}

/*
  Weighted least-squares polynomial fit via the normal equations, reusing
  solveLinearSystem. Returns coefficients [c0, c1, ...] for y = c0 + c1*x + ...
*/
function weightedPolyFit(samples, degree) {
  const matrix = []
  const vector = []

  for (let row = 0; row <= degree; row++) {
    matrix[row] = []
    for (let col = 0; col <= degree; col++) {
      matrix[row][col] = samples.reduce((sum, sample) => sum + sample.weight * Math.pow(sample.x, row + col), 0)
    }
    vector[row] = samples.reduce((sum, sample) => sum + sample.weight * sample.y * Math.pow(sample.x, row), 0)
  }

  return solveLinearSystem(matrix, vector)
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])

  for (let pivot = 0; pivot < size; pivot++) {
    let pivotRow = pivot
    for (let row = pivot + 1; row < size; row++) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) {
        pivotRow = row
      }
    }
    if (Math.abs(augmented[pivotRow][pivot]) < Number.EPSILON) return null

    if (pivotRow !== pivot) {
      const temp = augmented[pivot]
      augmented[pivot] = augmented[pivotRow]
      augmented[pivotRow] = temp
    }

    const pivotValue = augmented[pivot][pivot]
    for (let col = pivot; col <= size; col++) {
      augmented[pivot][col] /= pivotValue
    }

    for (let row = 0; row < size; row++) {
      if (row === pivot) continue
      const factor = augmented[row][pivot]
      for (let col = pivot; col <= size; col++) {
        augmented[row][col] -= factor * augmented[pivot][col]
      }
    }
  }

  return augmented.map(row => row[size])
}
