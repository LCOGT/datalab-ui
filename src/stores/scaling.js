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
      channels: {},
      version: 0, // Incremented for lightweight reactivity trigger
    }
  },
  getters: {
    pixelCount: (state) => {
      return state.compositeImageData ? state.compositeImageData.width * state.compositeImageData.height : 0
    },
  },
  actions: {
    // eslint-disable-next-line no-unused-vars
    initializeCanvas(width) {
      this.compositeImageData = new ImageData(width, width)
      // Set alpha channel to 255 (opaque)
      for (let i = 3; i < this.compositeImageData.data.length; i += 4) {
        this.compositeImageData.data[i] = 255
      }
    },
    updateImageArray(color, newImageDataArray) {
      if (!this.compositeImageData) return

      // Composite should always match the pixel count of incoming data
      if( newImageDataArray.length !== this.pixelCount ) {
        console.error('New image data array length does not match pixel count')
        const newDimensions = Math.sqrt(newImageDataArray.length)
        this.initializeCanvas(newDimensions, newDimensions)
      }

      // Unique key for each color channel e.g "255,0,0"
      const { r, g, b } = color
      const colorKey = `${r},${g},${b}`
      const oldImageData = this.channels[colorKey]?.data

      const normalizedColor = { r: r / 255, g: g / 255, b: b / 255 }

      // Store the new channel data
      this.channels[colorKey] = {
        data: newImageDataArray,
        color: normalizedColor,
      }
      try {
        throw new Error('applyChannelUpdate TODO fix')
        // eslint-disable-next-line no-unreachable
        this._applyChannelUpdate(oldImageData, newImageDataArray, normalizedColor)
      } catch (error) {
        this.rebuildCompositeImage()
        console.error('Error applying channel update, rebuilding composite image', error)
      }
    },
    // More performant way to update the composite image when only one channel changes
    // FIX: oldPixelValue is always 0, so delta is always newPixelValue, why?
    _applyChannelUpdate(oldData, newData, color) {
      const compositeData = this.compositeImageData.data

      for (let i = 0; i < this.pixelCount; i++) {
        const oldPixelValue = oldData?.[i] || 0
        const newPixelValue = newData[i]
        const delta = newPixelValue - oldPixelValue

        if (oldPixelValue != 0){
          console.log(oldPixelValue, newPixelValue, delta)
        }

        // If there's no change for this pixel, skip calculation
        if (delta === 0) continue

        const compositeIndex = i * 4
        compositeData[compositeIndex + 0] += delta * color.r
        compositeData[compositeIndex + 1] += delta * color.g
        compositeData[compositeIndex + 2] += delta * color.b
      }

      this.version += 1
    },
    // Legacy code, but useful if entire image needs to be rebuilt in case of deletion of a channel
    rebuildCompositeImage() {
      if (!this.compositeImageData) return

      const compositeData = this.compositeImageData.data
      const activeChannels = Object.values(this.channels)

      for (let channelIndex = 0; channelIndex < this.pixelCount; channelIndex++) {
        const compositeIndex = channelIndex * 4

        let finalR = 0
        let finalG = 0
        let finalB = 0

        // Loop through every active channel and add its contribution to the pixel
        for (const channel of activeChannels) {
          if (channel.data) {
            const pixelValue = channel.data[channelIndex]
            finalR += pixelValue * channel.color.r
            finalG += pixelValue * channel.color.g
            finalB += pixelValue * channel.color.b
          }
        }

        compositeData[compositeIndex + 0] = finalR
        compositeData[compositeIndex + 1] = finalG
        compositeData[compositeIndex + 2] = finalB
      }

      this.version += 1
    },
  }
})
