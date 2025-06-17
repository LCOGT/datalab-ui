import { defineStore } from 'pinia'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall } from '@/utils/api.js'

/**
 * This store manages the images and analysis results displayed on the analysis page.
 */
export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    // General Analysis State
    image: null, // image archive object
    headerData: null, // FITS header data for the image
    // Histogram Editing
    rawData: null, // raw data from the analysis/raw_data endpoint
    zmin: null, // minimum z value of the raw data
    zmax: null, // maximum z value of the raw data
    imageUrl: '', // URL of the image to display
    imageWidth: null, // width of the image in pixels
    imageHeight: null, // height of the image in pixels
    imageScaleLoading: false, // flag to indicate if the image scale is loading
    // Variable Star Analysis
    lightCurve: null, // light curve data for a source
    lightCurveTarget: null, // target for the light curve
    lightCurveLoading: false, // flag to indicate if the light curve is loading
  }),
  getters: {
    // General
    imageProposalId: (state) => { return state.image.proposal_id},
    imageFilter: (state) => { return state.image.FILTER },
    // Histogram Editing
    imageScaleReady: (state) => state.imageWidth && state.imageHeight && state.rawData && state.zmin != null && state.zmax != null,
    histogram: (state) => { return state.rawData.histogram },
    bins: (state) => { return state.rawData.bins },
    maxPixelValue: (state) => { Math.pow(2, state.rawData.bitdepth) - 1 },
  },
  actions: {
    // Histogram Editing
    async loadScaleData() {
      this.imageScaleLoading = true

      if(!this.image){
        console.error('No image object provided')
        return
      }

      if(!this.imageScaleReady){
        await this.loadImageDimensions(this.imageUrl || this.image.largeCachedUrl)
        await this.loadRawData()
      }

      this.imageScaleLoading = false
    },
    loadImageDimensions(url) {
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

      const requestBody = {
        'basename': this.image.basename,
        'source': this.image.source,
        'max_size': Math.min(Math.min(this.imageWidth, this.imageHeight), 1024),
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
    async loadHeaderData() {
      const configStore = useConfigurationStore()
      const alertsStore = useAlertsStore()

      if(this.headerData && Object.keys(this.headerData).length > 0) {
        return true
      }

      const archiveHeadersUrl = configStore.datalabArchiveApiUrl + 'frames/' + this.image.id + '/headers/'
      fetchApiCall({url: archiveHeadersUrl, method: 'GET', 
        successCallback: (response) => {
          this.headerData = response.data
          return true
        },
        failCallback: (error) => {
          console.error('Failed to fetch headers:', error)
          alertsStore.setAlert('error', `Could not fetch headers for frame ${this.image.id}`)
          return false
        }
      })
    },
    setLightCurveData(data) {
      this.lightCurve = data.light_curve
      this.lightCurveTarget = data.target_coords
      this.lightCurveLoading = false
      console.log('light curve response, setLightCurveData(data)', this.lightCurve, this.lightCurveTarget)
    }
  },
})
