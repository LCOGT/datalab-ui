import { defineStore } from 'pinia'

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
})
