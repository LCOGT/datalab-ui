<script setup>
import { ref, computed, onBeforeMount, onUnmounted, watch } from 'vue'
import ProjectBar from '@/components/Project/ProjectBar.vue'
import ImageCarousel from '@/components/Project/ImageCarousel.vue'
import ImageList from '@/components/Project/ImageList.vue'
import { useRouter } from 'vue-router'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingsStore } from '@/stores/settings'
import { useUserDataStore } from '@/stores/userData'
import { fetchApiCall } from '../utils/api'

const router = useRouter()
const configurationStore = useConfigurationStore()
const settingsStore = useSettingsStore()
const userDataStore = useUserDataStore()
const isPopupVisible = ref(false)
const uniqueDataSessions = ref([])
const newSessionName = ref('')
const errorMessage = ref('')
const isLoading = ref(true)
const selectedProject = ref(null)
const dataSessionsUrl = configurationStore.datalabApiBaseUrl + 'datasessions/'

onBeforeMount(() => {
  if (!userDataStore.userIsAuthenticated) router.push({ name: 'Registration' })
})

const selectedProjectImages = ref([])

// handles the selected project to filter images that only have the selected proposal_id
async function filterImagesByProposalId(proposalId) {
  // selectedProjectImages.value = imageCache.value.filter(image => proposalId.includes(image.proposal_id))
  selectedProject.value = proposalId
  if (!settingsStore.imagesByProposal[proposalId]) {
    isLoading.value = true
    await settingsStore.loadAndCacheImages(proposalId, 'reduction_level=91')
  }
  isLoading.value = false
  selectedProjectImages.value = settingsStore.imagesByProposal[proposalId]
}

// boolean computed property used to disable the add to session button
const noSelectedImages = computed(() => {
  return settingsStore.selectedImages.length === 0
})

const imageCounter = computed(() => {
  return settingsStore.selectedImages.length
})

const unselectImages = () => {
  settingsStore.selectedImages = []
}

// manages successful api response by mapping data to unique sessions
const mapDataSessions = (data) => {
  const results = data.results
  uniqueDataSessions.value = results
    .map(session => ({ id: session.id, name: session.name }))
  isPopupVisible.value = true
}

// manages api call failures by logging errors
const handleError = (error) => {
  console.error('API call failed with error:', error)
  errorMessage.value = error.message || 'An error occurred'
}

// fetches session data from API and handles response or error using the callbacks
const getDataSessions = async () => {
  await fetchApiCall({ url: dataSessionsUrl, method: 'GET', successCallback: mapDataSessions, failCallback: handleError })
}

// updates an existing session with selected images
const addImagesToExistingSession = async (session) => {
  const sessionIdUrl = dataSessionsUrl + session.id + '/'
  // fetches existing session data
  const currentSessionResponse = await fetchApiCall({ url: sessionIdUrl, method: 'GET' })
  if (currentSessionResponse) {
    const currentSessionData = currentSessionResponse.input_data
    // merging existing and new image data
    // this is temporary since the backend has to be updated to handle this
    // remove this when backend gets updated
    const selectedImages = settingsStore.selectedImages
    const inputData = [...currentSessionData, ...selectedImages.map(image => ({
      'source': 'archive',
      'basename': image.basename.replace('-small', '') || image.basename.replace('-large', '')
    }))]
    const requestBody = {
      'name': session.name,
      'input_data': inputData
    }

    // sending the PATCH request with the merged data
    await fetchApiCall({ url: sessionIdUrl, method: 'PATCH', body: requestBody })
  } else {
    handleError()
  }
}

// closes popup, invokes addImagesToExistingSession, and reroutes user to DataSessions view
const selectDataSession = async (session) => {
  isPopupVisible.value = false
  await addImagesToExistingSession(session)
  router.push({ name: 'DataSessionView' })

}

const validateSessionName = () => {
  errorMessage.value = ''

  if (sessionNameExists(newSessionName.value)) {
    errorMessage.value = 'Data Session name already exists. Please choose a different name.'
    return
  } else if (newSessionName.value.length < 5) {
    errorMessage.value = 'Data Session name is too short.'
    return
  } else if (newSessionName.value.length > 25) {
    errorMessage.value = 'Data Session name is too long.'
    return
  }
}

const closePopup = () => {
  isPopupVisible.value = false
  newSessionName.value = ''
  errorMessage.value = ''
}

// handles creation of a new session 
const createNewDataSession = async () => {
  const selectedImages = settingsStore.selectedImages
  const inputData = selectedImages.map(image => ({
    'source': 'archive',
    'basename': image.basename.replace('-small', '') || image.basename.replace('-large', '')
  }))
  const requestBody = {
    'name': newSessionName.value,
    'input_data': inputData
  }

  // attempting a POST request for new session
  const response = await fetchApiCall({ url: dataSessionsUrl, method: 'POST', body: requestBody })
  if (response) {
    isPopupVisible.value = false
    newSessionName.value = ''
    errorMessage.value = ''
    settingsStore.recentSessionId = response.id
    router.push({ name: 'DataSessionView' })
  } else {
    errorMessage.value = 'Error creating new data session'
  }
}

const sessionNameExists = (name) => {
  return uniqueDataSessions.value.some(session => session.name === name)
}

watch(() => userDataStore.proposals, async () => {
  if (userDataStore.proposals.length > 0) {
    filterImagesByProposalId(userDataStore.proposals[0].id)
  }
}, { immediate: true })

watch(() => settingsStore.startDate, async () => {
  settingsStore.imagesByProposal = {}
  if (selectedProject.value){
    filterImagesByProposalId(selectedProject.value)
  }
})

onUnmounted(() => {
  unselectImages()
})

</script>

<template>
  <!-- only load if config is loaded -->
  <section>
  <div class="container">
    <div class="columns">
    <ProjectBar
      :projects="userDataStore.proposals"
      @selected-project="filterImagesByProposalId"
    />
    <div class="column">
      <div
        v-if="isLoading"
        class="loading-indicator-container"
      >
        <v-progress-circular
          indeterminate
          model-value="20"
          :size="50"
          :width="9"
        />
      </div>
      <div v-else>
        <div class="control-buttons">
        <v-btn
          :disabled="noSelectedImages"
          class="unselect_images"
          prepend-icon="mdi-trash-can-outline"
          @click="unselectImages"
        >
          Clear
        </v-btn>
        <v-btn
          :disabled="noSelectedImages"
          class="add_button"
          prepend-icon="mdi-plus"
          @click="getDataSessions"
        >
          <template v-if="imageCounter === 0">
            Select
          </template>
          <template v-else>
            Add {{ imageCounter }} image<span v-if="imageCounter > 1">
              s
            </span>
          </template>
        </v-btn>
      </div>
        <ImageCarousel
          v-if="userDataStore.carouselGridToggle && selectedProjectImages.length"
          :data="selectedProjectImages"
        />
        <ImageList
          v-if="!userDataStore.carouselGridToggle && selectedProjectImages.length"
          :data="selectedProjectImages"
        />
        <v-banner
          v-if="!selectedProjectImages.length"
          class="d-flex align-center justify-center mt-10"
          icon="mdi-image-off"
          color="warning"
          text="This project has no images in the specified time period"
        />
      </div>
    </div>
  </div>
  </div>
  <v-dialog
    v-model="isPopupVisible"
    width="300"
  >
    <v-card class="card">
      <v-card-title class="sessions_header">
        DATA SESSIONS
      </v-card-title>
      <v-card-text class="scroll-container">
        <v-list>
          <v-list-item
            v-for="session in uniqueDataSessions"
            :key="session.id"
            class="sessions"
            @click="selectDataSession(session)"
          >
            {{ session.name }}
          </v-list-item>
        </v-list>
      </v-card-text>
      <!-- Input for new session name -->
      <div class="create-container">
        <v-text-field
          v-model="newSessionName"
          label="New Session Name"
          class="new-session-field sessions"
          @input="validateSessionName"
        />
        <!-- Error message -->
        <div
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </div>
        <v-card-actions class="button-container">
          <v-btn
            text 
            class="cancel_button" 
            @click="closePopup"
          >
            Close
          </v-btn>
          <v-btn
            text
            class="create_button" 
            @click="createNewDataSession"
          >
            Create New Session
          </v-btn>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
  </section>  
</template>
<style scoped>

.project-bar{
  display: flex;
  grid-column-start: col1-start;
  grid-column-end: col1-end;
  grid-row-start: row-start;
  grid-row-end: row-end;
  height: 100%;
}
.image-area {
  position: relative;
  grid-column-start: col2-start;
  grid-column-end: col2-end;
}
.loading-indicator-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
.add_button {
  width: 17.3rem;
  height: 4rem;
  font-size: 1.3rem;
  margin-right: 1rem;
  background-color: var(--light-blue);
  color: var(--tan);
  opacity: calc(1);
  font-weight: 700;
}
.add_button:disabled {
  opacity: calc(0.7);
}
.unselect_images {
  width: 17.3rem;
  height: 4rem;
  font-size: 1.3rem;
  margin-right: 1rem;
  background-color: var(--cancel);
  color: var(--tan);
  opacity: calc(1);
  font-weight: 700;
}
.unselect_images:disabled {
  opacity: calc(0.7);
}
.card{
  height: 550px;
  width: 900px;
  align-self: center;
  display: flex !important;
}
.sessions_header {
  font-family: 'Open Sans', sans-serif;
  font-size: 1.6rem;
  padding: 1.5rem;
  text-align: center;
  color: var(--tan);
  font-weight: 600;
  letter-spacing: 0.05rem;
}
.scroll-container {
  overflow-y: scroll;
}
.v-list-item {
  overflow: auto;
}
.sessions {
  font-family: 'Open Sans', sans-serif;
  color: var(--tan);
  font-size: 1.4rem;
}
.create-container {
  display: flex;
  flex-direction: column;
  width: 100%; 
}
.new-session-field {
  max-height: 40px;
  max-width: 90%;
  margin-left: 3%;
}
.error-message {
  color: var(--cancel);
  font-size: 1.1rem;
  font-family: 'Open Sans', sans-serif;
  margin-left: 10%;
  position: fixed;
  bottom: 10%;
}
.button-container {
  font-family: 'Open Sans', sans-serif;
  padding: 0 1rem;
  margin-top: 7%;
  flex-direction: row;
  justify-content: space-between;
}
.create_button {
  color: var(--light-blue);
  font-weight: 700;
  font-size: 1.4rem;
}
.cancel_button {
  color: var(--cancel);
  font-weight: 700;
  font-size: 1.4rem;
}
@media (max-width: 1200px) {
  .card {
    height: 55vh;
    width: 30vw;
    align-self: center;
  }
  .sessions_header {
    font-size: 1.2rem;
    padding: 0.8rem;
  }
  .project-bar {
    height: 60%;
  }
  .button {
    font-family: 'Open Sans', sans-serif;
    font-size: 1rem;
    padding: 0 1rem;
    margin-bottom: 1rem;
  }
  .sessions {
    font-family: 'Open Sans', sans-serif;
    font-size: 0.85rem;
  }
}
@media (max-width: 900px) {
  .card {
    width: 40vw;
    height: 35vh;
  } 
  .project-bar {
    height: 35vh;
    width: 25vw;
    margin-right: 1.5rem;
  }
}
</style>
