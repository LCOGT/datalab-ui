import { defineStore } from 'pinia'
import { convertFilter, filterToPixelIndex } from '@/utils/common'

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
      if (!(combinedImageName in this.scaledImageArrays)) {
        this.scaledImageArrays[combinedImageName] = {}
      }
      let rgbFilter = convertFilter(filter)
      if (!('combined' in this.scaledImageArrays[combinedImageName])) {
        this.arrayChanged[combinedImageName] = 0
        this.scaledImageArrays[combinedImageName]['combined'] = new ImageData(maxSize, maxSize)
        this.scaledImageArrays[combinedImageName]['combined'].data.fill(255)
      }
      let filterIndex = filterToPixelIndex(rgbFilter)
      for (let i = filterIndex, j=0; j < imageDataArray.length; i += 4, j++) {
        this.scaledImageArrays[combinedImageName]['combined'].data[i] = imageDataArray[j]
      }
      this.arrayChanged[combinedImageName]++
    }
  }
})
