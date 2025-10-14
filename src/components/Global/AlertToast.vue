<script setup>
import { ref, watch } from 'vue'
import { useAlertsStore } from '../../stores/alerts'

/*
  This component shows alert toasts for user notifications.
  It listens to the alerts store for changes and displays the alert message accordingly.
*/

const alertStore = useAlertsStore()
const showAlert = ref(false)

watch(() => alertStore.alertTimeStamp, () => {
  showAlert.value = true
  setTimeout(() => {
    showAlert.value = false
  }, 5000)
})

</script>
<template>
  <v-fade-transition>
    <v-alert
      v-model="showAlert"
      closable
      :type="alertStore.alertType"
      :text="alertStore.alertText"
    />
  </v-fade-transition>
</template>
<style scoped>
  .v-alert {
    position: absolute;
    bottom: 0;
    left: 0;
    /* to show above the v-overlay whose z-index is 2400 */
    z-index: 2401;
    padding: 10px;
    margin: 2rem;
  }
</style>
