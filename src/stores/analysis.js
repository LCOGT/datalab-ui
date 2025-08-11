import { defineStore } from 'pinia'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall } from '@/utils/api.js'

const MAX_IMAGE_DIMENSION = 1024 // Maximum dimension for performance

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
    variableStarData: {
      loading: false, // flag to indicate if variable star data is loading
      targetCoords: 0, // target coordinates for the variable star
      magTimeSeries: [], // time series data for the variable star
      magPeriodogram: [], // magTimeSeries sorted by phase
      period: 0, // period of the variable star
      falseAlarmProbability: 0, // false alarm probability for the variable star
      fluxFallback: false, // flag to indicate if flux fallback is used
      excludedImages: [], // list of excluded images for the variable star
    },
  }),
  getters: {
    // General
    imageProposalId: (state) => { return state.image.proposal_id},
    imageFilter: (state) => { return state.image.FILTER },
    loading: (state) => { return state.imageScaleLoading || state.variableStarData.loading },
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
          this.imageWidth = Math.min(img.width, MAX_IMAGE_DIMENSION)
          this.imageHeight = Math.min(img.height, MAX_IMAGE_DIMENSION)
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
        'max_size': Math.min(this.imageWidth, this.imageHeight),
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
      const { light_curve, target_coords, period, fap, flux_fallback, excluded_images } = data

      this.$patch({
        variableStarData: {
          loading: false,
          targetCoords: target_coords,
          magTimeSeries: light_curve,
          magPeriodogram: light_curve,
          period: period,
          falseAlarmProbability: fap,
          fluxFallback: flux_fallback,
          excludedImages: excluded_images,
        }
      })

      // Fold the light curve data over the period
      function foldPeriod(magTimeSeries, period){
        magTimeSeries.forEach(mts => {
          mts.jd_folded = (mts.julian_date % period)
          mts.phase = (mts.jd_folded / period)
        })
      }
      
      foldPeriod(this.variableStarData.magTimeSeries, this.variableStarData.period)

      // Sort the light curve data by phase
      this.variableStarData.magPeriodogram = [...this.variableStarData.magTimeSeries].sort((a, b) => a.phase - b.phase)

      this.variableStarData.loading = false
    }
  },
})
