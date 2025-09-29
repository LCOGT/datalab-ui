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
    }
  },
  actions: {
    updateImageArray(color, imageDataArray, maxSize) {
      const newCompositeImageData = new ImageData(maxSize, maxSize)
      newCompositeImageData.data.fill(255)
      const data = newCompositeImageData.data
      
      const filterIndex = 1 // TODO make this dynamic based on color input
      for (let i = filterIndex, j = 0; j < imageDataArray.length; i += 4, j++) {
        data[i] = imageDataArray[j]
      }

      this.compositeImageData = newCompositeImageData
    }
  }
})
