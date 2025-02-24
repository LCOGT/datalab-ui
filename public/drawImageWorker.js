var context, imageData, sharedArrayBuffer, sharedArray, gammaTable, imageDataObject
let hasImageData = false
let hasCanvas = false
let queuedScalePoints = []
 
/**
 * Web workers function a little differently in that onmessage is always called
 * from the main thread and it can persist variables in the worker
 * What it does is based on what arguments are passed in from the main thread.
 * This lets us seed the web worker with some initial data that it uses
 * to recompute the pixel values with each slider value change
 */
onmessage = function(job) {
  var payload = job.data

  if (payload.canvas) {
    // Init worker with the canvas, width, height, imageData, and sharedArrayBuffer
    context = payload.canvas.getContext('2d')
    sharedArrayBuffer = payload.sharedArrayBuffer
    sharedArray = new Uint8ClampedArray(sharedArrayBuffer)
    imageDataObject = new ImageData(payload.width, payload.height)

    // Create a gamma table
    let size = 256
    let gamma = 2.5
    gammaTable = []
    for (let i = 0; i < size; i++) {
      gammaTable.push(parseInt(size * Math.pow(i / size, 1.0 / gamma)))
    }

    hasCanvas = true
    attemptProcessScaleQueue()
  }

  if (payload.imageData) {
    imageData = payload.imageData
    hasImageData = true
    attemptProcessScaleQueue()
  }

  if (payload.scalePoints) {
    queuedScalePoints.push(payload.scalePoints)
    attemptProcessScaleQueue()
  }
}

function attemptProcessScaleQueue() {
  if(hasImageData && hasCanvas && queuedScalePoints.length > 0) {
    // optimization to process only most recent queued scale
    processScalePoints(queuedScalePoints.pop())
    queuedScalePoints = []
  }
}

function processScalePoints(scalePoints) {
  // Re-compute the image and redraw it to the canvas
  const low16Bit = parseInt(scalePoints[0])
  const high16Bit = parseInt(scalePoints[1])
  const scale = 255 / (high16Bit - low16Bit)

  for (let i = 0; i < imageData.data.length; i++) {
    const clippedValue = Math.max(low16Bit, Math.min(high16Bit, imageData.data[i]))
    const normalizedValue = Math.floor((clippedValue - low16Bit) * scale)
    sharedArray[i] = gammaTable[normalizedValue]
    imageDataObject.data[i * 4] = gammaTable[normalizedValue]
    imageDataObject.data[i * 4 + 1] = gammaTable[normalizedValue]
    imageDataObject.data[i * 4 + 2] = gammaTable[normalizedValue]
    imageDataObject.data[i * 4 + 3] = 255
  }
  context.putImageData(imageDataObject, 0, 0)
  postMessage({'updateSharedArray': true})
}
