import { defineStore } from 'pinia'

/**
 * This store is used to store intermediate images in scaling to then use in a composite image
 * The point of storing it in the store is that it is more performant then using emit/props
 * for these large data arrays
 */
export const useScalingStore = defineStore('scaling', {
  state() {
    return{
      sharedArrayBuffers: new Array(),
      sharedArrays: new Array(),
      colors: new Array(),
      readyToUpdate: new Array(),
      readyToBegin: false,
    }
  },
  actions: {
    clearChannels() {
      this.sharedArrayBuffers = new Array(),
      this.sharedArrays = new Array(),
      this.readyToUpdate = new Array(),
      this.colors = new Array()
      this.readyToBegin = false
    },
    clearReadyToUpdate() {
      for (let i = 0; i < this.readyToUpdate.length; i++) {
        this.readyToUpdate[i] = false
      }
    },
    initializeChannel(color, width, height) {
      let index = this.sharedArrayBuffers.length
      // SharedArrayBuffer is used for the web worker to fill in data that will then be sent
      // by the main thread to the store for the composite image preview
      this.sharedArrayBuffers.push(new SharedArrayBuffer(Uint8ClampedArray.BYTES_PER_ELEMENT * width * height))
      this.sharedArrays.push(new Uint8ClampedArray(this.sharedArrayBuffers[index]))
      this.readyToUpdate.push(false)
      let normalizedColor = [color.r / 255, color.g / 255, color.b / 255]
      this.colors.push(normalizedColor)
      return index
    }
  }
})
