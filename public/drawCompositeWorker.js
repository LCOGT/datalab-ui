// This web worker is used to draw a multi-channel color composite image offscreen
var canvas, context, imageData, sharedArrayBuffers, sharedArrays, colors, gammaTable, outputImage, scalePointMessage
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
    // This is a Uint8ClampedArray under the hood to it will clamp values >255 to 255
    outputImage = new ImageData(payload.canvas.width, payload.canvas.height)
    const outputImageData = outputImage.data
    const numPixels = payload.canvas.width * payload.canvas.height * 4
    // Loop over every pixels 4th channel to set the base alpha channel to 255
    for (let j = 3; j < numPixels; j += 4) {
      outputImageData[j] = 255
    }

    // Instantiate sharedArrays of the sharedArrayBuffers to pull data out of
    if(payload.sharedArrayBuffers){
      sharedArrayBuffers = payload.sharedArrayBuffers
      colors = payload.colors
      sharedArrays = new Array(sharedArrayBuffers.length)
      for (let i = 0; i < sharedArrayBuffers.length; i++) {
        sharedArrays[i] = new Uint8ClampedArray(sharedArrayBuffers[i]) 
      }
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

  if (payload.indicesChanged) {
    redrawCompositeImage(payload.indicesChanged)
  }
}

async function redrawCompositeImage(indicesChanged) {
  // indicesChanged isn't currently used but notifies which of the color channels has changed since last redraw
  const outputImageData = outputImage.data
  if (colors.length > 0) {
    // Set the first images color constributions as the base values, loop over every pixel
    for (let j = 0; j < sharedArrays[0].length; j++) {
      // Loop over the 3 color channels we have (r, g, b)
      for (let c = 0; c < 3; c++) {
        const pixelIndex = (j * 4) + c
        if (colors[0][c] > 0) {
          outputImageData[pixelIndex] = sharedArrays[0][j] * colors[0][c]
        }
        else {
          outputImageData[pixelIndex] = 0
        }
      }
    }
  }
  
  for (let i = 1; i < colors.length; i++) {
    // For each other color channel, add its scaled values multiplied by its normalized color to each color channel
    for (let j = 0; j < sharedArrays[i].length; j++) {
      // Loop over the 3 color channels again
      for (let c = 0; c < 3; c++) {
        const pixelIndex = (j * 4) + c
        // If that color channel value is nonzero, then add it into the composite pixel value
        if (colors[i][c] > 0) {
          outputImageData[pixelIndex] += sharedArrays[i][j] * colors[i][c]
        }
      }
    }
  }

  // Now clip and gamma adjust the output image
  for (let j = 0; j < outputImageData.length; j += 4) {
    outputImageData[j] = gammaTable[outputImageData[j]]
    outputImageData[j+1] = gammaTable[outputImageData[j+1]]
    outputImageData[j+2] = gammaTable[outputImageData[j+2]]
  }

  // Now draw the output image
  context.putImageData(outputImage, 0, 0)
  postMessage({'redrawImage': true})
}
