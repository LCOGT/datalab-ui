
var context, width, height, imageData, imageDataArray, sharedArrayBuffer, sharedArray, gammaTable
 
// Web workers function a little differently in that this method is always called
// from the main thread, but it can persist values in the worker, and what it does
// is based on what arguments are passed in from the main thread.
// This lets us seed the web worker with some initial data that it uses
// to recompute the pixel values with each slider value change
onmessage = function(event) {
  if (event.data.canvas) {
    // This is the starter message with the canvas, width, height, imageData, and shared data array
    context = event.data.canvas.getContext('2d')
    width = event.data.width
    height = event.data.height
    sharedArrayBuffer = event.data.sharedArrayBuffer
    sharedArray = new Uint8ClampedArray(sharedArrayBuffer)
    imageDataObject = context.createImageData(width, height)
    let size = 256
    let gamma = 2.5
    gammaTable = []
    for (let i = 0; i < size; i++) {
      gammaTable.push(parseInt(size * Math.pow(i / size, 1.0 / gamma)))
    }
  }
  if (event.data.imageData) {
    imageData = event.data.imageData
  }
  if (event.data.scalePoints) {
    // If scalePoints is sent, then we can re-compute the image and redraw it to the canvas
    const low16Bit = parseInt(event.data.scalePoints[0])
    const high16Bit = parseInt(event.data.scalePoints[1])
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
}
