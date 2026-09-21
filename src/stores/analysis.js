import { defineStore } from 'pinia'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall } from '@/utils/api.js'

export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    image: null,
    headerData: null,
    imageUrl: '',
  }),
  actions: {
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
    }
  },
})
