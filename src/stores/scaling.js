import { defineStore } from 'pinia'
import { filterToPixelIndex } from '@/utils/common'

/**
 * This store is used to store intermediate images in scaling to then use in a composite image
 * The point of storing it in the store is that it is more performant then using emit/props
 * for these large data arrays
 */
export const useScalingStore = defineStore('scaling', {
  state() {
    return{
      scaledImageArrays: {},
      arrayChanged: {}
    }
  },
  actions: {
    updateImageArray(combinedImageName, filter, imageDataArray, maxSize) {
      let scaledImages = this.scaledImageArrays
      let arrayChanged = this.arrayChanged

      if (!(combinedImageName in scaledImages)) {
        scaledImages[combinedImageName] = {}
      }

      var combined = scaledImages[combinedImageName]['combined']

      if (!('combined' in scaledImages[combinedImageName])) {
        arrayChanged[combinedImageName] = 0
        combined = new ImageData(maxSize, maxSize)
        combined.data.fill(255)
        scaledImages[combinedImageName]['combined'] = combined
      }

      const filterIndex = filterToPixelIndex(filter)
      const combinedData = combined.data

      for (let i = filterIndex, j=0; j < imageDataArray.length; i += 4, j++) {
        combinedData[i] = imageDataArray[j]
      }
      arrayChanged[combinedImageName]++
    }
  }
})
