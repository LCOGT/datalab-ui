import { getRelativePosition } from 'chart.js/helpers'

/*
  The draggable two-line min/max window shared by ParallaxHistogram and DistanceHistogram:
  a Chart.js plugin that draws the dashed bounds with grab handles, plus pointer handlers to
  drag a line and adjust the window, or drag across an empty plot to create one. Everything
  here is identical between the two histograms; the host supplies only what differs - the
  value<->pixel mapping (linear or log), the value-space extent, the rounding precision, and
  how to read and emit the bounds.

  Options (all read lazily, so the chart can be created after this is called):
    chart:        () => Chart|null            the chart instance
    min, max:     () => number|null           current window bounds (from props)
    emitMin/Max:  (value) => void             emit the v-model:...-min / -max update
    valueToPixel: (chart, value) => number    value -> x pixel
    pixelToValue: (chart, pixel) => number    x pixel -> value
    extent:       () => {min, max}|null        value-space span of the bars (null when no data)
    round:        (value) => number           snap emitted bounds to the axis precision
    lineColor:    () => string                dashed line / handle color

  Returns { windowActive, plugin, attach, detach }.
*/

const LINE_GRAB_PIXELS = 8
const HANDLE_WIDTH = 8
const HANDLE_HEIGHT = 16

export function useHistogramWindowSelect({ chart, min, max, emitMin, emitMax, valueToPixel, pixelToValue, extent, round, lineColor }) {
  function windowActive() {
    return Number.isFinite(min()) && Number.isFinite(max())
  }

  // a boundary line is drawn clamped to the chart area, so out-of-range bounds stay visible
  // AND grabbable there - the hit test must use this same clamped position
  function boundPixel(chartInstance, value) {
    const area = chartInstance.chartArea
    return Math.min(Math.max(valueToPixel(chartInstance, value), area.left), area.right)
  }

  const plugin = {
    id: 'histogramWindowBounds',
    afterDatasetsDraw(chartInstance) {
      if (!windowActive() || !extent()) return
      const { ctx, chartArea } = chartInstance
      ctx.save()
      ctx.strokeStyle = lineColor()
      ctx.fillStyle = lineColor()
      ctx.lineWidth = 2
      for (const value of [min(), max()]) {
        const pixelX = boundPixel(chartInstance, value)
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(pixelX, chartArea.top)
        ctx.lineTo(pixelX, chartArea.bottom)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillRect(pixelX - HANDLE_WIDTH / 2, chartArea.top, HANDLE_WIDTH, HANDLE_HEIGHT)
      }
      ctx.restore()
    }
  }

  let dragMode = null       // 'min' | 'max' | 'create' | null
  let createAnchor = null   // the fixed edge while dragging out a new window
  let createMoved = false   // whether a create drag actually moved (else it was a stray click)
  let pendingEmit = null     // batched { min?, max? }, flushed at most once per frame
  let emitScheduled = false

  // which boundary line, if any, is under the pointer (at its drawn, clamped position)
  function hitTest(pixelX) {
    if (!windowActive() || !extent()) return null
    const chartInstance = chart()
    const toMin = Math.abs(pixelX - boundPixel(chartInstance, min()))
    const toMax = Math.abs(pixelX - boundPixel(chartInstance, max()))
    if (Math.min(toMin, toMax) > LINE_GRAB_PIXELS) return null
    return toMin <= toMax ? 'min' : 'max'
  }

  function clampToExtent(value) {
    const span = extent()
    return span ? Math.min(Math.max(value, span.min), span.max) : value
  }

  // live-updating on every pointermove is wasteful, so emit at most once per frame
  function scheduleEmit(update) {
    pendingEmit = { ...pendingEmit, ...update }
    if (emitScheduled) return
    emitScheduled = true
    requestAnimationFrame(() => {
      if (pendingEmit.min !== undefined) emitMin(pendingEmit.min)
      if (pendingEmit.max !== undefined) emitMax(pendingEmit.max)
      pendingEmit = null
      emitScheduled = false
    })
  }

  function onPointerDown(event) {
    const chartInstance = chart()
    const position = getRelativePosition(event, chartInstance)
    const grabbed = hitTest(position.x)
    if (grabbed) {
      dragMode = grabbed
    } else if (!windowActive() && extent()) {
      // no window yet: start dragging one out, both edges anchored at this point for now
      dragMode = 'create'
      createAnchor = clampToExtent(pixelToValue(chartInstance, position.x))
      createMoved = false
      scheduleEmit({ min: round(createAnchor), max: round(createAnchor) })
    } else {
      return   // a window exists but no line was grabbed: ignore, like the PM plot
    }
    event.target.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event) {
    const chartInstance = chart()
    const position = getRelativePosition(event, chartInstance)
    if (!dragMode) {
      // a crosshair invites drawing a window when none exists, else resize over a line
      chartInstance.canvas.style.cursor = windowActive()
        ? (hitTest(position.x) ? 'ew-resize' : 'default')
        : 'crosshair'
      return
    }
    const value = clampToExtent(pixelToValue(chartInstance, position.x))
    if (dragMode === 'create') {
      createMoved = true
      scheduleEmit({ min: round(Math.min(createAnchor, value)), max: round(Math.max(createAnchor, value)) })
    } else if (dragMode === 'min') {
      scheduleEmit({ min: round(Math.min(value, max())) })   // the bounds may not cross
    } else {
      scheduleEmit({ max: round(Math.max(value, min())) })
    }
  }

  function onPointerUp(event) {
    // a create gesture that never moved is a stray click - don't leave a zero-width window
    if (dragMode === 'create' && !createMoved) {
      scheduleEmit({ min: null, max: null })
    }
    dragMode = null
    createAnchor = null
    event.target.releasePointerCapture?.(event.pointerId)
  }

  function attach() {
    const canvas = chart().canvas
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
  }

  function detach() {
    const canvas = chart()?.canvas
    if (!canvas) return
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
  }

  return { windowActive, plugin, attach, detach }
}
