import { defineStore } from 'pinia'
import { useConfigurationStore } from '@/stores/configuration' 
import { fetchApiCall } from '@/utils/api.js'

/**
 * This store manages the images and analysis results displayed on the analysis page.
 */
export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    image: null, // image archive object
    rawData: null, // raw data from the analysis/raw_data endpoint
    zmin: null, // minimum z value of the raw data
    zmax: null, // maximum z value of the raw data
    imageUrl: '', // URL of the image to display
    imageWidth: null, // width of the image in pixels
    imageHeight: null, // height of the image in pixels
  }),
  getters: {
    imageScaleReady: (state) => state.imageWidth && state.imageHeight && state.rawData && state.zmin && state.zmax,
    histogram: (state) => { return state.rawData.histogram },
    bins: (state) => { return state.rawData.bins },
    maxPixelValue: (state) => { Math.pow(2, state.rawData.bitdepth) - 1 },
  },
  actions: {
    async loadScaleData() {
      if(!this.imageScaleReady){
        await this.loadImageDimensions()
        await this.loadRawData()
      }
    },
    // Load image dimensions
    loadImageDimensions() {
      // Check if image dimensions are already loaded
      if (this.imageWidth && this.imageHeight) {
        return
      }
      
      if (!this.imageUrl) {
        console.error('No image URL provided')
        return
      }

      const url = this.imageUrl || this.image.largeCachedUrl
      const img = new Image()
      img.src = url
      return new Promise((resolve) => {
        img.onload = () => {
          this.imageWidth = img.width
          this.imageHeight = img.height
          resolve()
        }
      })
    },
    async loadRawData() {
      // Check if data is already loaded
      if (this.rawData && this.zmin && this.zmax) {
        return {rawData: this.rawData, zmin: this.zmin, zmax: this.zmax}
      }

      const configStore = useConfigurationStore()
      const datalabApiBaseUrl = configStore.datalabApiBaseUrl
      const url = datalabApiBaseUrl + 'analysis/raw-data/'

      if(!this.image){
        console.error('No image object provided')
        return
      }

      const requestBody = {
        'basename': this.image.basename,
        'source': this.image.source,
        'max_size': Math.max(this.imageWidth, this.imageHeight),
      }

      await fetchApiCall({url: url, method: 'POST', body: requestBody,
        successCallback: (response) => {
          this.rawData = response
          this.zmin = response.zmin
          this.zmax = response.zmax
          return({rawData: this.rawData, zmin: this.zmin, zmax: this.zmax})
        },
        failCallback: (error) => {
          console.error('Could not load raw_data', error)
        }
      })
    },
  },
})
