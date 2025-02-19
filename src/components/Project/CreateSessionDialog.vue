<script setup>
import { onMounted, ref } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useUserDataStore } from '@/stores/userData'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall } from '@/utils/api'
import { useRouter } from 'vue-router'

const configurationStore = useConfigurationStore()
const userDataStore = useUserDataStore()
const alertsStore = useAlertsStore()
const router = useRouter()

const newSessionName = ref('')
const dataSessionsList = ref([])
const dataSessionsUrl = configurationStore.datalabApiBaseUrl + 'datasessions/'

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  newImages: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

// updates an existing session with selected images
async function addImagesToExistingSession(session){
  // fetches existing session data
  const sessionIdUrl = dataSessionsUrl + session.id + '/'
  const existingSession = await fetchApiCall({ url: sessionIdUrl, method: 'GET' })

  // TODO - Patch should be handled by the backend, add endpoint to support the merging of old and new images
  const inputData = [...existingSession.input_data, ...props.newImages.map(image => ({
    'source': 'archive',
    'basename': image.basename.replace('-small', '') || image.basename.replace('-large', ''),
    'id': image.id,
    'url': image.url,
    'filter': image.FILTER
  }))]
  const requestBody = {
    'name': session.name,
    'input_data': inputData
  }

  // sending the PATCH request with the merged data
  await fetchApiCall({ url: sessionIdUrl, method: 'PATCH', body: requestBody, successCallback: routeToDataSessionView })
}

// handles creation of a new session 
async function createNewDataSession(){
  if (!validateSessionName()) return
  // Add more fields from the archive image here if needed
  const inputData = props.newImages.map(image => ({
    'source': 'archive',
    'basename': image.basename.replace('-small', '') || image.basename.replace('-large', ''),
    'id': image.id,
    'url': image.url,
    'filter': image.FILTER
  }))
  const requestBody = {
    'name': newSessionName.value,
    'input_data': inputData
  }

  // attempting a POST request for new session
  await fetchApiCall({ url: dataSessionsUrl, method: 'POST', body: requestBody, successCallback: routeToDataSessionView})
}

function routeToDataSessionView(response){
  userDataStore.activeSessionId = response.id
  router.push({ name: 'DataSessionView' })
}

function validateSessionName(){
  if (dataSessionsList.value.some(session => session.name === newSessionName.value)) {
    alertsStore.setAlert('error', `${newSessionName.value} already exists`)
    return false
  } else if (newSessionName.value.length < 5) {
    alertsStore.setAlert('warning', 'Data Session Name should be at least 5 characters long')
    return false
  } else if (newSessionName.value.length > 25) {
    alertsStore.setAlert('warning', `Data Session Name ${newSessionName.value} exceeds 25 characters`)
    return false
  }
  return true
}

// fetches session data from API and handles response or error using the callbacks
async function getDataSessions (){
  await fetchApiCall({ url: dataSessionsUrl, method: 'GET', successCallback: (data) => {
    dataSessionsList.value = data.results.map(session => ({ id: session.id, name: session.name, lastAccessed: session.accessed }))
  }})
}

onMounted(() => {
  getDataSessions()
})

</script>
<template>
  <v-dialog
    class="create-session-dialog"
    :model-value="modelValue"
    persistent
  >
    <v-card class="card">
      <v-card-title class="sessions_header d-flex justify-space-between align-center">
        Existing Data Sessions
        <v-btn
          icon="mdi-close"
          variant="text"
          color="var(--cancel)"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>
      <v-card-subtitle>
        Select an existing session or create a new one
      </v-card-subtitle>
      <v-card-text>
        <v-list class="sessions-list">
          <v-list-item
            v-for="session in dataSessionsList"
            :key="session.id"
            class="sessions"
            @click="addImagesToExistingSession(session)"
          >
            {{ session.name }}
            <span class="last-modified-text">
              modified {{ new Date(session.lastAccessed).toLocaleDateString() }}
            </span>
          </v-list-item>
        </v-list>
      </v-card-text>
      <!-- Input for new session name -->
      <v-card-actions class="button-container">
        <v-text-field
          v-model="newSessionName"
          label="Create New Session"
          class="new-session-field"
        />
        <v-btn
          text="Create"
          class="create_button" 
          @click="createNewDataSession"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<style scoped>
.create-session-dialog {
  font-family: 'Open Sans', sans-serif;
}

.card{
  height: 70vh;
  width: 40vw;
  align-self: center;
  display: flex !important;
  background-color: var(--dark-blue);
  color: var(--tan);
  padding: 1rem
}
.sessions_header {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.05rem;
}
.sessions-list {
  overflow-y: scroll;
  font-size: 1.4rem;
  color: var(--tan);
  background-color: var(--dark-blue);
}
.last-modified-text {
  font-size: 0.8rem;
  color: var(--light-blue);
  opacity: 0.7;
  float: right;
}
.validation-hint {
  color: var(--cancel);
  font-size: 1.1rem;
  margin-left: 10%;
  bottom: 10%;
}
.button-container {
  margin: 1rem;
  flex-direction: row;
  justify-content: space-around;
  align-content: space-around;
}
.create_button {
  color: var(--light-blue);
  font-weight: 700;
  font-size: 1.4rem;
}
</style>
