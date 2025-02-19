import { defineStore } from 'pinia'

/**
 * This store is used to manage the alert that is displayed at the top of the page.
 * The alert can be of type 'success', 'error', 'warning', or 'info'.
 * To use this import the store and call the setAlert action with the type and text of the alert.
 */
export const useAlertsStore = defineStore('alerts', {
  state() {
    return{
      alertType: 'info', // alert type to display ('success', 'error', 'warning', 'info')
      alertText: 'default alert text', // text displayed in alert
      alertTimeStamp: '0' // timestamp of the last alert, used for watching in AlertToast.vue
    }
  },
  actions: {
    setAlert(type, text, prefix = '') {
      this.alertType = type
      this.alertText = prefix ? prefix + ' ' + text : text
      this.alertTimeStamp = Date.now()
    }
  }
})
