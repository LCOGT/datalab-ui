<script setup>
import { ref, computed, onMounted, onBeforeMount, onUnmounted } from 'vue'
import ProjectBar from '@/components/Project/ProjectBar.vue'
import ImageCarousel from '@/components/Project/ImageCarousel.vue'
import ImageList from '@/components/Project/ImageList.vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { fetchApiCall } from '../utils/api'

const router = useRouter()
const store = useStore()
const isPopupVisible = ref(false)
const uniqueDataSessions = ref([])
const newSessionName = ref('')
const errorMessage = ref('')
const isLoading = ref(true)
const dataSessionsUrl = store.state.datalabApiBaseUrl + 'datasessions/'

onBeforeMount(() => {
  if (!store.getters['userData/userIsAuthenticated']) router.push({ name: 'Registration' })
})

// toggle for optional data viewing, controlled by a v-switch
let imageDisplayToggle = ref(true)

let smallImageCache = ref([])
const projects = ref({})
const selectedProjectImages = ref([])

// Loads the user's Images from their profile into userImages ( currently just fetches all frames from archive regardless of proposal )
const loadUserImages = async (option) => {
  isLoading.value = true
  await store.dispatch('loadAndCacheImages', { option })
  isLoading.value = false
  smallImageCache.value = store.state.smallImageCache
  updateGroupedProjects()
}

// groups all projects by proposal id
function groupByProposalId() {
  if (smallImageCache.value) {
    return smallImageCache.value.reduce((acc, project) => {
      if (!acc[project.proposal_id]) {
        acc[project.proposal_id] = []
      }
      acc[project.proposal_id].push(project)
      return acc
    }, {})
  }
}

// sorts projects by group id and handles selectedproject as the first one for when the page first loads 
function updateGroupedProjects() {
  projects.value = groupByProposalId(smallImageCache.value)
  const firstProjectKey = Object.keys(projects.value)[0]
  if (firstProjectKey) {
    const firstProjectProposalIds = [firstProjectKey]
    filterImagesByProposalId(firstProjectProposalIds)
  }
}

// handles the selected project to filter images that only have the selected proposal_id
const filterImagesByProposalId = (proposalId) => {
  selectedProjectImages.value = smallImageCache.value.filter(image => proposalId.includes(image.proposal_id))
}

// boolean computed property used to disable the add to session button
const noSelectedImages = computed(() => {
  return store.getters.selectedImages.length === 0
})

const imageCounter = computed(() => {
  return store.state.selectedImages.length
})

const unselectImages = () => {
  store.commit('selectedImages', [])
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
    const selectedImages = store.state.selectedImages
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
  router.push({ name: 'DataSessionDetails', params: { sessionId: session.id } })

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
  const selectedImages = store.state.selectedImages
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
    router.push({ name: 'DataSessionDetails', params: { sessionId: response.id } })
  } else {
    errorMessage.value = 'Error creating new data session'
  }
}

const sessionNameExists = (name) => {
  return uniqueDataSessions.value.some(session => session.name === name)
}

onMounted(() => {
  loadUserImages('reduction_level=95')
  loadUserImages('reduction_level=96')
})

onUnmounted(() => {
  unselectImages()
})

</script>

<template>
  <!-- only load if config is loaded -->
  <div class="container">
    <ProjectBar
      class="project-bar"
      :projects="projects"
      @selected-project="filterImagesByProposalId"
    />
    <div class="image-area h-screen">
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
        <ImageCarousel
          v-if="imageDisplayToggle && selectedProjectImages.length"
          :data="selectedProjectImages"
        />
        <ImageList
          v-if="!imageDisplayToggle && selectedProjectImages.length"
          :data="selectedProjectImages"
        />
        <p v-if="!selectedProjectImages.length">
          Please create a project to use Datalab
        </p>
      </div>
      <v-skeleton-loader
        v-if="!store.state.smallImageCache"
        type="card"
      />
      <div class="control-buttons">
        <v-switch
          v-model="imageDisplayToggle"
          class="d-flex mr-4"
          inset
          prepend-icon="mdi-view-list"
          append-icon="mdi-image"
        />
        <v-btn
          :disabled="noSelectedImages"
          class="add_button"
          @click="getDataSessions"
        >
          <template v-if="imageCounter === 0">
            Select images
          </template>
          <template v-else>
            Add {{ imageCounter }} image<span v-if="imageCounter > 1">s</span>
          </template>
        </v-btn>
        <v-btn
          :disabled="noSelectedImages"
          class="unselect_images"
          @click="unselectImages"
        >
          Unselect All Images
        </v-btn>
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
</template>
<style scoped>
.container{
  margin: 0;
  display: grid;
  grid-template-columns: [col1-start] 1fr [col1-end col2-start] 80% [col2-end];
  grid-template-rows: [row-start] 100% [row-end];
  height: 100vh;
}
.project-bar{
  display: flex;
  grid-column-start: col1-start;
  grid-column-end: col1-end;
  grid-row-start: row-start;
  grid-row-end: row-end;
  height: 50%;
}
.image-area {
  grid-column-start: col2-start;
  grid-column-end: col2-end;
}
.loading-indicator-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
.control-buttons {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  float: right;
  position: fixed;
  bottom: 2%;
  right: 3%;
}
.add_button {
  width: 17.3rem;
  height: 4rem;
  font-size: 1.3rem;
  align-content: center;
  margin-right: 0.5rem;
  background-color: var(--light-blue);
  opacity: calc(1);
  font-weight: 700;
  color: white;
}
.add_button:disabled {
  background-color:var(--light-blue);
  color: white;  
  opacity: calc(0.7);
}
.unselect_images {
  width: 17.3rem;
  height: 4rem;
  font-size: 1.3rem;
  align-content: center;
  margin-right: 1rem;
  background-color: var(--cancel);
  opacity: calc(1);
  font-weight: 700;
  color: white;
}
.unselect_images:disabled {
  background-color:var(--cancel);
  color: white;  
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
  .add_button {
    width: 12rem;
    height: 3rem;
    font-size: 1rem;
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
  .add_button {
    width: 22vw;
    height: 4.8vh;
    font-size: 1rem;
  } 
  .project-bar {
    height: 35vh;
    width: 25vw;
    margin-right: 1.5rem;
  }
}
</style>
