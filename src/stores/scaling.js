import { defineStore } from 'pinia'

/**
 * This store is used to store intermediate images in scaling to then use in a composite image
 * The point of storing it in the store is that it is more performant then using emit/props
 * for these large data arrays
 */
export const useScalingStore = defineStore('scaling', {
  state() {
    return{
      compositeImageData: null,
      version: 0, // Incremented for lightweight reactivity trigger
    }
  },
  actions: {
    initializeCanvas(maxSize) {
      this.compositeImageData = new ImageData(maxSize, maxSize)
    },
    updateImageArray(color, imageDataArray) {
      // Convert color 0-255 to 0-1 range for future blending modes
      var { r, g, b } = color
      r = r / 255.0
      g = g / 255.0
      b = b / 255.0

      const compositeData = this.compositeImageData.data
      
      for (let greyscaleIndex = 0; greyscaleIndex < imageDataArray.length; greyscaleIndex++) {
        const pixelValue = imageDataArray[greyscaleIndex]
        const compositeIndex = greyscaleIndex * 4

        // For now we only support "sum" blending mode
        // Add the tinted value to the corresponding channel in our raw data array
        if (r > 0) compositeData[compositeIndex + 0] += pixelValue * r // Red
        if (g > 0) compositeData[compositeIndex + 1] += pixelValue * g // Green
        if (b > 0) compositeData[compositeIndex + 2] += pixelValue * b // Blue
        compositeData[compositeIndex + 3] = 255 // Alpha always 255
      }

      this.version += 1
    },
  }
})
