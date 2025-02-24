<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { VDateInput } from 'vuetify/labs/VDateInput'
import ImageList from '@/components/Project/ImageList.vue'
import ImageGrid from '@/components/Global/ImageGrid.vue'
import CreateSessionDialog from '@/components/Project/CreateSessionDialog.vue'
import { useUserDataStore } from '@/stores/userData'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall } from '@/utils/api'
import { initializeDate } from '@/utils/common'
import { useRoute } from 'vue-router'
import router from '@/router'

const route = useRoute()

const userDataStore = useUserDataStore()
const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()
const alertsStore = useAlertsStore()

const showCreateSessionDialog = ref(false)
const imagesByProposal = ref({})
const selectedImagesByProposal = ref({})
const startDate = ref(initializeDate(route.query.startDate, -3))
const endDate = ref( initializeDate(route.query.endDate))
const ra = ref(route.query.ra)
const dec = ref(route.query.dec)
const search = ref(route.query.search)
const observationId = ref(route.query.observationId)

const selectedImages = computed(() => {
  // returns a list combining all the selected images in all projects to be used for a new data session
  return Object.keys(selectedImagesByProposal.value).reduce((acc, projectId) => {
    const proposalImages = imagesByProposal.value[projectId] ? imagesByProposal.value[projectId] : []
    const proposalSelectedImages = selectedImagesByProposal.value[projectId]
    return acc.concat(proposalImages.filter(image => proposalSelectedImages.includes(image.basename)))
  }, [])
})

function selectImage(proposalIndex, basename) {
  // accepts either a list of selected images or a single image index to toggle selection on
  const proposalSelectedImages = selectedImagesByProposal.value[proposalIndex]
  
  if(proposalSelectedImages.includes(basename)){
    proposalSelectedImages.splice(proposalSelectedImages.indexOf(basename), 1)
  } else {
    proposalSelectedImages.push(basename)
  }
}

function deselectAllImages() {
  // clear the arrays per proposal in selectedImagesByProposal
  Object.keys(selectedImagesByProposal.value).forEach(projectId => {
    selectedImagesByProposal.value[projectId] = []
  })
}

async function loadProposals(option){
  // Update the URL with the current filters
  router.push({ query: { ra: ra.value, dec: dec.value, observationId: observationId.value, search: search.value, startDate: startDate.value.toISOString(), endDate: endDate.value.toISOString() } })

  // Only loads images for open proposal panels
  userDataStore.openProposals.forEach(async proposal => {
    // if there the value for the key is null the user is not authorized to view the proposal
    if(!userDataStore.proposals[proposal]) return

    const proposalID = userDataStore.proposals[proposal].id
    const baseUrl = configurationStore.datalabArchiveApiUrl + 'frames/'
    const timeStr = `start=${startDate.value.toISOString()}&end=${endDate.value.toISOString()}`
    
    option = `${option}&${timeStr}&proposal_id=${proposalID}&include_thumbnails=true`
    if(ra.value && dec.value) option += `&covers=POINT(${ra.value} ${dec.value})`
    if(observationId.value) option += `&observation_id=${observationId.value}`

    const imageUrl = option ? `${baseUrl}?${option}` : baseUrl
    const responseData = await fetchApiCall({ url: imageUrl, method: 'GET' })

    if (responseData && responseData.results) {
      // Preload all the small thumbnails into the cache. The large thumbnails will be loaded on demand
      // TODO: The processing of frames should be moved to the thumbnails store or the thumbnail's utility file
      responseData.results.forEach((frame) => {
        frame.smallThumbUrl = ''
        frame.largeThumbUrl = ''
        frame.source = 'archive'
        for (const thumbnail of frame.thumbnails) {
          if (thumbnail.size === 'small') {
            frame.smallThumbUrl = thumbnail.url
          }
          else if (thumbnail.size === 'large') {
            frame.largeThumbUrl = thumbnail.url
          }
        }
        frame.smallCachedUrl = ref('')
        thumbnailsStore.cacheImage('small', configurationStore.archiveType, frame.smallThumbUrl, frame.basename).then((cachedUrl) => {
          frame.smallCachedUrl.value = cachedUrl
        })
      })
      // Add images to their proposal group
      imagesByProposal.value[proposalID] = responseData.results
    }
  })
}

watch(() => [startDate.value, endDate.value], async () => {
  // Filters that can be queried instantly with no debounce
  loadProposals('reduction_level=91')
})

watch(() => [ra.value, dec.value, observationId.value], async () => {
  // Clear the Search filter if the ra or dec field is cleared
  if(!ra.value || !dec.value){
    search.value = ''
  }
  if((ra.value && isNaN(ra.value)) || (dec.value && isNaN(dec.value))){
    alertsStore.setAlert('warning', 'RA and DEC must be a number')
  }
  if(observationId.value && isNaN(observationId.value)){
    alertsStore.setAlert('warning', `Observation ID is not a number ${observationId.value}`)
  }
  // Debouncing the load so users have time to finish typing
  else if(setTimeout(async () => {
    await loadProposals('reduction_level=91')
  }, 1700)){
    clearTimeout()
  }
})

watch(() => search.value, async () => {
  // Search has its own watcher since we would like to clear the ra and dec fields when the search field is cleared
  if(search.value){
    const url = `https://simbad2k.lco.global/${search.value}`
    fetchApiCall({url: url, method: 'GET', successCallback: (data)=> {
      if(!data.error){
        ra.value = data.ra_d
        dec.value = data.dec_d
      }
    }})
  }
  else{
    ra.value = null
    dec.value = null
  }
})

onMounted(() => {
  // Check so Observe@PTR can open the relevant proposal
  if(route.query.proposalId){
    const proposalIndexToOpen = userDataStore.proposals.findIndex(proposal => proposal.id == route.query.proposalId)
    if(proposalIndexToOpen != -1)
      userDataStore.openProposals = [proposalIndexToOpen]
    else
      alertsStore.setAlert('warning', `Proposal ${route.query.proposalId} not found in users proposals`)
  }
  loadProposals('reduction_level=91')
  // create selected images array for each proposal
  userDataStore.proposals.forEach(proposal => {
    selectedImagesByProposal.value[proposal.id] = []
  })
})

</script>

<template>
  <div class="proposal-filters">
    <v-date-input
      v-model="startDate"
      :max="endDate"
      label="From"
      prepend-icon=""
      prepend-inner-icon="$calendar"
      :hide-actions="true"
      hide-details="auto"
    />
    <v-date-input
      v-model="endDate"
      :max="new Date()"
      :min="startDate"
      label="To"
      prepend-icon=""
      prepend-inner-icon="$calendar"
      :hide-actions="true"
      hide-details="auto"
    />
    <v-text-field
      v-model="observationId"
      label="Observation ID"
      clearable
      hide-details
    />
    <v-text-field
      v-model="ra"
      label="RA"
      clearable
      hide-details
    />
    <v-text-field
      v-model="dec"
      label="DEC"
      clearable
      hide-details
    />
    <v-text-field
      v-model="search"
      prepend-inner-icon="mdi-magnify"
      label="Sources"
      clearable
      hide-details
    />
    <v-switch
      v-model="userDataStore.gridToggle"
      color="var(--light-blue)"
      base-color="var(--light-blue)"
      prepend-icon="mdi-view-list"
      append-icon="mdi-image"
    />
  </div>
  <div class="proposal-images">
    <v-expansion-panels
      v-model="userDataStore.openProposals"
      variant="accordion"
      :multiple="true"
      bg-color="var(--metal)"
    >
      <v-expansion-panel
        v-for="proposal in userDataStore.proposals"
        :key="proposal.id"
      >
        <v-expansion-panel-title @click="loadProposals('reduction_level=91')">
          <p>{{ proposal.title }}</p>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <image-grid
            v-if="userDataStore.gridToggle"
            :images="imagesByProposal[proposal.id]"
            :selected-images="selectedImagesByProposal[proposal.id]"
            :allow-selection="true"
            :column-span="5"
            @select-image="selectImage(proposal.id, $event)"
          />
          <image-list
            v-else
            :images="imagesByProposal[proposal.id]"
            :selected-images="selectedImagesByProposal[proposal.id]"
            @select-image="selectImage(proposal.id, $event)"
          />
          <div
            v-if="imagesByProposal[proposal.id]?.length == 0"
            class="no-images mt-5 d-flex flex-column justify-center align-center"
          >
            <v-icon
              icon="mdi-image-off"
              :size="100"
            />
            <h1>No Images Found</h1>
            <p>Try changing the date range or filters to see more images</p>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
  <div class="proposal-buttons">
    <v-btn
      :disabled="selectedImages.length == 0"
      class="proposal-button deselect_button"
      prepend-icon="mdi-trash-can-outline"
      text="Clear"
      @click="deselectAllImages"
    />
    <v-btn
      :disabled="selectedImages.length == 0"
      class="proposal-button add_button"
      :text=" selectedImages.length == 0 ? 'No Images' : `Add ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}` "
      @click="showCreateSessionDialog=true"
    />
  </div>
  <create-session-dialog
    v-model="showCreateSessionDialog"
    :new-images="selectedImages"
  />
</template>
<style scoped>
.proposal-filters{
  display: flex;
  gap: 1rem;
  margin: 1rem;
  color: var(--tan);
}
.v-expansion-panel-title p{
  color: var(--tan);
  font-weight: 700;
  font-size: 1.3rem;
}
.proposal-images {
  margin-left: 1rem;
  margin-right: 1rem;
  max-height: 70%;
  overflow-y: scroll;
}
.no-images{
  color: var(--tan);
}
.proposal-buttons {
  margin-bottom: 1rem;
  position: fixed;
  bottom: 0;
  right: 0;
  color: var(--tan);
}
.proposal-button {
  margin-right: 1rem;
  background-color: var(--light-blue);
  font-weight: 700;
  font-size: 1.3rem;
  margin-right: 1rem;
}
.proposal-button:disabled {
  opacity: calc(0.5);
}
.add_button {
  width: 14rem;
  height: 3rem;
  background-color: var(--light-blue);
  color: var(--off-white);
}
.deselect_button {
  width: 10rem;
  height: 3rem;
  background-color: var(--cancel);
  color: var(--off-white);
}
</style>
