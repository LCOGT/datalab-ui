import { defineStore } from 'pinia'
import { fetchApiCall } from '@/utils/api.js'
import { useAlertsStore } from '@/stores/alerts'

export const useConfigurationStore = defineStore('configuration', {
  state() {
    return {
      isConfigLoaded: false,
      datalabApiBaseUrl: '',
      datalabArchiveApiUrl: '',
      simbad2kUrl: '',
      observationPortalUrl: '',
      thumbnailServiceUrl: '',
      archiveType: 'ptr',
    }
  },
  actions: {
    async loadHeaderData(imageId) {
      const alertsStore = useAlertsStore()
      let headerData = null
      const archiveHeadersUrl = this.datalabArchiveApiUrl + 'frames/' + imageId + '/headers/'
      return new Promise((resolve, reject) => {
        fetchApiCall({
          url: archiveHeadersUrl,
          method: 'GET',
          successCallback: (response) => {
            headerData = response.data
            resolve(headerData)
          },
          failCallback: (error) => {
            console.error('Failed to fetch headers:', error)
            alertsStore.setAlert('error', `Could not fetch headers for frame ${imageId}`)
            reject(null)
          }
        })
      })
    }
  }
})
