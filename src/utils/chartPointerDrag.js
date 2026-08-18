import { getRelativePosition } from 'chart.js/helpers'

/*
  The pointer plumbing shared by the draggable chart overlays (the proper-motion selection
  circle and the histogram min/max window): canvas listeners, pointer capture, hover vs drag
  dispatch, and two-finger pinch tracking. It deals only in pixel coordinates - every host
  maps those to its own value space.

  Options (all read lazily, so the chart can be created after this is called):
    chart:        () => Chart|null                     the chart instance
    onDown:       (point, event) => boolean            true to begin a drag and capture the pointer;
                                                       false leaves the pointer to the chart itself
    onDrag:       (point, event) => void               pointer moved with a drag in progress
    onHover:      (point, event) => string|undefined   pointer moved with no drag; returns the cursor
    onUp:         () => void                           the drag ended (pointer up, cancelled, or
                                                       superseded by a pinch)
    onPinchStart: ([pointA, pointB]) => void           optional; a second finger went down
    onPinchMove:  ([pointA, pointB]) => void           optional; either finger moved
    onPinchEnd:   () => void                           optional; a finger lifted

  Omitting the pinch callbacks opts out of pinch entirely: extra fingers are then ignored
  rather than allowed to hijack the drag in progress.

  Returns { attach, detach }.
*/
export function useChartPointerDrag({ chart, onDown, onDrag, onHover, onUp, onPinchStart, onPinchMove, onPinchEnd }) {
  let mode = null   // 'drag' | 'pinch' | null
  let dragPointerId = null
  // every non-mouse pointer down on the canvas, whether or not onDown wanted it: a pinch
  // usually starts with both fingers on empty plot, so declining a drag must not stop the
  // finger counting. Insertion-ordered, so the first two stay the pinching pair even if a
  // third finger lands mid-gesture. A mouse is left out - it can never be a second finger,
  // and a button released off-canvas delivers no pointerup here to clear it again.
  const activePointers = new Map()

  const pinchEnabled = () => !!(onPinchStart && onPinchMove)

  function pointerPosition(event) {
    const position = getRelativePosition(event, chart())
    return { pixelX: position.x, pixelY: position.y }
  }

  function pinchPair() {
    const [pointA, pointB] = [...activePointers.values()]
    return [pointA, pointB]
  }

  function setCursor(cursor) {
    const canvas = chart()?.canvas
    if (canvas) canvas.style.cursor = cursor || 'default'
  }

  function endDrag() {
    if (mode !== 'drag') return
    mode = null
    dragPointerId = null
    onUp()
  }

  function onPointerDown(event) {
    const point = pointerPosition(event)
    if (event.pointerType !== 'mouse') activePointers.set(event.pointerId, point)

    if (activePointers.size === 2 && pinchEnabled()) {
      // a pinch supersedes whatever the first finger was doing
      endDrag()
      mode = 'pinch'
      onPinchStart(pinchPair())
    } else if (mode || activePointers.size > 1) {
      return   // mid-gesture already, or an extra finger with no pinch to join
    } else if (onDown(point, event)) {
      mode = 'drag'
      dragPointerId = event.pointerId
    } else {
      return   // the host wants nothing to do with this pointer
    }
    event.target.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event) {
    const point = pointerPosition(event)
    if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, point)

    if (mode === 'pinch') {
      onPinchMove(pinchPair())
    } else if (mode === 'drag') {
      // a second pointer moving mid-drag is not the one being dragged with
      if (event.pointerId === dragPointerId) onDrag(point, event)
    } else {
      setCursor(onHover(point, event))
    }
  }

  function onPointerUp(event) {
    activePointers.delete(event.pointerId)
    if (mode === 'pinch') {
      // the finger left behind goes idle rather than resuming a drag it never started
      mode = null
      onPinchEnd?.()
    } else {
      endDrag()
    }
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

  return { attach, detach }
}

/*
  This is used to batch up the frequent updates we get from pointer move or touchscreen events
  It ensures we only update the data once per rendered frame. On the next frame render,
  the applyUpdates callback is called to apply whatever updates into the chart the caller needs.
*/
export function rafBatch(applyUpdates) {
  let pending = null
  let scheduled = false
  return function schedule(updates) {
    pending = { ...pending, ...updates }
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      const batch = pending
      pending = null
      scheduled = false
      applyUpdates(batch)
    })
  }
}
