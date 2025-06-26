<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { VDateInput } from 'vuetify/labs/VDateInput'
import ImageList from '@/components/Project/ImageList.vue'
import ImageGrid from '@/components/Global/ImageGrid.vue'
import InsetIconSwitch from '@/components/Global/InsetIconSwitch.vue'
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
const loadingProposals = ref(false)
const startDate = ref(initializeDate(route.query.startDate, -3))
const endDate = ref( initializeDate(route.query.endDate))
const ra = ref(route.query.ra || '')
const dec = ref(route.query.dec || '')
const search = ref(route.query.search || '')
const observationId = ref(route.query.observationId || '')
const target = ref(route.query.target || '')
const userID = ref(route.query.userId || userDataStore.userId || '')
let filtersDebounceTimer
const FILTER_DEBOUNCE = 1000

const selectedImages = computed(() => {
  // returns a list combining all the selected images in all projects
  return Object.entries(selectedImagesByProposal.value).flatMap(([proposalId, selectedBasenames]) => {
    const proposalImages = imagesByProposal.value[proposalId] || []
    return proposalImages.filter(image => selectedBasenames.includes(image.basename))
  })
})

const filterTextFields = computed(() => {
  return [
    { label: 'User ID', model: userID, key: 'userId' },
    { label: 'Target Name', model: target, key: 'target' },
    ...(userDataStore.coordsToggle ? 
      [{ label: 'Simbad Lookup', model: search, key: 'search', class: 'simbad-search order-2' }] :
      [{ label: 'RA', model: ra, key: 'ra', class: 'order-2' }, { label: 'DEC', model: dec, key: 'dec', class: 'order-2' }]
    )
  ]
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
  for (const projectId in selectedImagesByProposal.value) {
    selectedImagesByProposal.value[projectId] = []
  }
}

async function loadProposals(){
  // Update the URL with the current filters
  router.push({ query: { 
    ra: ra.value,
    dec: dec.value,
    observationId: observationId.value,
    search: search.value,
    startDate: startDate.value.toISOString(),
    endDate: endDate.value.toISOString()
  } })

  loadingProposals.value = true

  if(userDataStore.openProposals.length === 0){
    loadingProposals.value = false
  }

  // Only loads images for open proposal panels to reduce downloads
  userDataStore.openProposals.forEach(async proposal => {
    // if there the value for the key is null the user is not authorized to view the proposal
    if(!userDataStore.proposals[proposal]) return

    // Inside the forEach loop of the loadProposals function
    const proposalID = userDataStore.proposals[proposal].id
    const baseUrl = configurationStore.datalabArchiveApiUrl + 'frames/'

    const params = new URLSearchParams({
      start: startDate.value.toISOString(),
      end: endDate.value.toISOString(),
      proposal_id: proposalID,
      include_thumbnails: 'true',
      reduction_level: '91'
    })

    if (ra.value && dec.value && !isNaN(ra.value) && !isNaN(dec.value)) params.set('covers', `POINT(${ra.value} ${dec.value})`)
    if (observationId.value && !isNaN(observationId.value)) params.set('observation_id', observationId.value)
    if (target.value) params.set('target_name', target.value)

    const imageUrl = `${baseUrl}?${params.toString()}`
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
      loadingProposals.value = false
    }
  })
}

watch(() => [startDate.value, endDate.value], async () => {
  // Filters that can be queried instantly with no debounce
  loadProposals()
})

watch(() => [ra.value, dec.value, observationId.value, target.value], async () => {
  clearTimeout(filtersDebounceTimer)

  if(isNaN(ra.value) || isNaN(dec.value)){
    alertsStore.setAlert('warning', 'RA and DEC must be a number')
  }
  else if(isNaN(observationId.value)){
    alertsStore.setAlert('warning', `Observation ID is not a number ${observationId.value}`)
  }
  else{
    // Debouncing the so users can finish typing before the API call is made
    filtersDebounceTimer = setTimeout(async () => { await loadProposals()}, FILTER_DEBOUNCE)
  }
})

watch(() => search.value, async () => {
  clearTimeout(filtersDebounceTimer)

  // Kicks off a call the the Simbad2k API to get the RA and DEC for the object
  if(search.value){
    filtersDebounceTimer = setTimeout(async () => {
      const url = `https://simbad2k.lco.global/${search.value}`
      await fetchApiCall({url: url, method: 'GET', successCallback: (data)=> {
        if(data.error){
          alertsStore.setAlert('warning', `Simbad ${data.error}`)
        }
        else if(data.eccentricity){
          alertsStore.setAlert('info', 'LCO archive does not support eccentric object lookup')
        }
        else{
          ra.value = data.ra_d
          dec.value = data.dec_d
        }
      }})
    }, FILTER_DEBOUNCE)
  }
  else{
    ra.value = null
    dec.value = null
  }
})

onMounted(() => {
  // Check so Explore@PTR can open the relevant proposal
  if(route.query.proposalId){
    const proposalIndexToOpen = userDataStore.proposals.findIndex(proposal => proposal.id == route.query.proposalId)
    if(proposalIndexToOpen != -1)
      userDataStore.openProposals = [proposalIndexToOpen]
    else
      alertsStore.setAlert('warning', `Proposal ${route.query.proposalId} not found in users proposals`)
  }
  loadProposals()
  // create selected images array for each proposal
  userDataStore.proposals.forEach(proposal => {
    selectedImagesByProposal.value[proposal.id] = []
  })
})

</script>

<template>
  <v-progress-linear
    v-hide="!loadingProposals"
    rounded
    indeterminate
    stream
    color="var(--success)"
  />
  <div class="proposal-filters d-flex ga-4 ml-4 mr-4 mt-2 mb-2">
    <v-date-input
      v-model="startDate"
      :max="endDate"
      label="From"
      prepend-icon=""
      prepend-inner-icon="$calendar"
      :hide-actions="true"
      hide-details="auto"
      color="var(--primary-interactive)"
      bg-color="var(--card-background)"
      variant="solo-filled"
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
      color="var(--primary-interactive)"
      bg-color="var(--card-background)"
      variant="solo-filled"
    />
    <v-text-field
      v-for="filter in filterTextFields"
      :key="filter.key"
      v-model="filter.model.value"
      :class="filter.class || ''"
      :label="filter.label"
      clearable
      hide-details
      color="var(--primary-interactive)"
      bg-color="var(--card-background)"
      variant="solo-filled"
    />
    <inset-icon-switch
      v-model="userDataStore.coordsToggle"
      class="order-1"
      true-icon="mdi-magnify"
      false-icon="mdi-crosshairs"
    />
  </div>
  <div class="proposal-images mr-4 ml-4">
    <v-expansion-panels
      v-model="userDataStore.openProposals"
      variant="accordion"
      :multiple="true"
      bg-color="var(--card-background)"
    >
      <v-expansion-panel
        v-for="proposal in userDataStore.proposals"
        :key="proposal.id"
        color="var(--secondary-background)"
      >
        <v-expansion-panel-title @click="loadProposals()">
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
            class="mt-5 d-flex flex-column justify-center align-center"
          >
            <v-icon
              icon="mdi-image-off"
              :size="100"
            />
            <h1>No Images Found</h1>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
  <div class="bottom-controls mr-4 ml-4 mb-4 d-flex ga-4">
    <inset-icon-switch
      v-model="userDataStore.gridToggle"
      class="mr-auto"
      true-icon="mdi-image"
      false-icon="mdi-view-list"
    />
    <v-btn
      :disabled="selectedImages.length == 0"
      class="proposal-button deselect_button"
      prepend-icon="mdi-trash-can-outline"
      text="Clear"
      base-color="var(--cancel)"
      @click="deselectAllImages"
    />
    <v-btn
      :disabled="selectedImages.length == 0"
      class="proposal-button add_button"
      :text=" selectedImages.length == 0 ? 'No Images' : `Add ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}` "
      base-color="var(--primary-interactive)"
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
  color: var(--text);
}
.v-expansion-panel-title p{
  color: var(--text);
  font-weight: 700;
  font-size: 1.3rem;
}
.proposal-images {
  max-height: 70%;
  height: 70%;
  overflow-y: scroll;
}
.bottom-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
.proposal-button {
  height: 3rem;
  font-weight: 700;
  font-size: 1.3rem;
  color: var(--text);
}
.add_button {
  width: 14rem;
}
.simbad-search {
  flex-grow: 2;
}
</style>
