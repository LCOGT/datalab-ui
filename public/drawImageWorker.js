var canvas, context, imageData, sharedArrayBuffer, sharedArray, gammaTable, outputImage, scalePointMessage
let hasImageData = false
let hasCanvas = false
 
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
    canvas = payload.canvas
    context = canvas.getContext('2d')
    outputImage = new ImageData(payload.width, payload.height)

    // Used for RGB stack, not used in grayscale scaling
    if(payload.sharedArrayBuffer){
      sharedArrayBuffer = payload.sharedArrayBuffer
      sharedArray = new Uint8ClampedArray(sharedArrayBuffer) 
    }

    // Create a gamma table
    let size = 256
    let gamma = 2.5
    gammaTable = []
    for (let i = 0; i < size; i++) {
      gammaTable.push(parseInt(size * Math.pow(i / size, 1.0 / gamma)))
    }

    hasCanvas = true
  }

  if (payload.imageData) {
    imageData = payload.imageData
    hasImageData = true
  }

  if (payload.scalePoints) {
    scalePointMessage = payload.scalePoints
  }

  tryProcessScalePoints()
}

function tryProcessScalePoints() {
  if(hasImageData && hasCanvas && scalePointMessage) {
    processScalePoints(scalePointMessage)
  }
}

async function processScalePoints(scalePoints) {
  // Re-compute the image and redraw it to the canvas
  const len = imageData.data.length
  const low16Bit = parseInt(scalePoints[0])
  const high16Bit = parseInt(scalePoints[1])
  const srcData = imageData.data
  const scale = 255 / (high16Bit - low16Bit)

  for (let i = 0; i < len; i++) {
    const clippedValue = Math.max(low16Bit, Math.min(high16Bit, srcData[i]))
    const normalizedValue = Math.floor((clippedValue - low16Bit) * scale)
    const gammaCorrected = gammaTable[normalizedValue]

    if(sharedArray) sharedArray[i] = gammaCorrected

    const outputImageData = outputImage.data
    const j = i * 4

    outputImageData[j] = gammaCorrected
    outputImageData[j + 1] = gammaCorrected
    outputImageData[j + 2] = gammaCorrected
    outputImageData[j + 3] = 255
  }

  context.putImageData(outputImage, 0, 0)

  // RGB uses sharedArrayBuffer, grayscale creates a blob
  if(!sharedArrayBuffer){
    const blob = await canvas.convertToBlob()
    postMessage({ blob: blob})
  }
  else {
    postMessage({'updateSharedArray': true})
  }
}
