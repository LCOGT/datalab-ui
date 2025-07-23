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
const filters = ref({
  start: {
    value: initializeDate(route.query.start, DEFAULT_DATE_RANGE_DAYS),
    toParam: (value) => value.toISOString(),
  },
  end: {
    value: initializeDate(route.query.end),
    toParam: (value) => value.toISOString(),
  },
  ra: {
    value: route.query.ra || '',
    label: 'RA',
    class: 'coords-search order-2',
    type: computed(() => userDataStore.coordsToggle ? 'hidden' : 'text'),
  },
  dec: {
    value: route.query.dec || '',
    label: 'DEC',
    class: 'coords-search order-2',
    type: computed(() => userDataStore.coordsToggle ? 'hidden' : 'text'),
  },
  search: {
    value: route.query.search || '',
    label: 'Simbad Lookup',
    class: 'simbad-search order-2',
    type: computed(() => userDataStore.coordsToggle ? 'text' : 'hidden'),
  },
  observation_id: {
    value: route.query.observation_id || '',
    label: 'Observation ID',
    type: 'hidden',
  },
  target_name: {
    value: route.query.target_name || '',
    label: 'Target Name',
  },
  submitter: {
    value: route.query.submitter || '',
    label: 'Submitter User ID',
  },
})
let filtersDebounceTimer
const FILTER_DEBOUNCE = 600
const DEFAULT_DATE_RANGE_DAYS = -30

const selectedImages = computed(() => {
  // returns a list combining all the selected images in all projects
  return Object.entries(selectedImagesByProposal.value).flatMap(([proposalId, selectedBasenames]) => {
    const proposalImages = imagesByProposal.value[proposalId] || []
    return proposalImages.filter(image => selectedBasenames.includes(image.basename))
  })
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
  const buildRouterQuery = () => {
    return Object.entries(filters.value).reduce((query, [key, filter]) => {
    // Only add the filter to the query if it has a value
      if (filter.value) {
      // Use the toParam function for special formatting (like dates) if it exists
        query[key] = filter.toParam ? filter.toParam(filter.value) : filter.value
      }
      return query
    }, {})
  }
  router.push({ query: buildRouterQuery() })

  loadingProposals.value = true

  if(userDataStore.openProposals.length === 0){
    loadingProposals.value = false
    return
  }

  // Only loads images for open proposal panels to reduce downloads
  userDataStore.openProposals.forEach(async proposal => {
    // if there the value for the key is null the user is not authorized to view the proposal
    if(!userDataStore.proposals[proposal]) return

    // Inside the forEach loop of the loadProposals function
    const proposalID = userDataStore.proposals[proposal].id
    const baseUrl = configurationStore.datalabArchiveApiUrl + 'frames/'

    const params = new URLSearchParams({
      proposal_id: proposalID,
      include_thumbnails: 'true',
      reduction_level: '91',
    })

    // Handle special 'covers' parameter from ra/dec
    if (filters.value.ra.value && filters.value.dec.value && !isNaN(filters.value.ra.value) && !isNaN(filters.value.dec.value)) {
      params.set('covers', `POINT(${filters.value.ra.value} ${filters.value.dec.value})`)
    }

    for (const [key, filter] of Object.entries(filters.value)) {
      if (key !== 'ra' && key !== 'dec') {
        const paramValue = filter.toParam ? filter.toParam(filter.value) : filter.value
        params.set(key, paramValue)
      }
    }

    const imageUrl = `${baseUrl}?${params.toString()}`

    await fetchApiCall({url: imageUrl, method: 'GET', 
      successCallback: (data) => {
        // Preload all the small thumbnails into the cache. The large thumbnails will be loaded on demand
        // TODO: The processing of frames should be moved to the thumbnails store or the thumbnail's utility file
        const archiveFrames = data.results
        archiveFrames.forEach((frame) => {
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
        imagesByProposal.value[proposalID] = archiveFrames
      },
      failCallback: (error) => {
        console.error('Failed to fetch frames:', error)
        alertsStore.setAlert('error', 'Failed to fetch frames from Science Archive')
      }
    })
    loadingProposals.value = false
  })
}

function invalidFilters() {
  const errors = []
  if (isNaN(filters.value.ra.value) || isNaN(filters.value.dec.value)) {
    errors.push('RA and DEC must be numbers.')
  }
  if (isNaN(filters.value.observation_id.value)) {
    errors.push('Observation ID must be a number.')
  }

  if (errors.length > 0) {
    const errorString = errors.join(' ')
    alertsStore.setAlert('error', errorString)
    return true
  }

  return false
}

watch(() => Object.values(filters.value)
  .filter(filter => filter.label !== 'Simbad Lookup')
  .map(filter => filter.value), async () => {
  clearTimeout(filtersDebounceTimer)
  filtersDebounceTimer = setTimeout(async () => {
    if(!invalidFilters()){
      await loadProposals()
    }
  }, FILTER_DEBOUNCE)
})

watch(() => filters.value.search.value, async () => {
  clearTimeout(filtersDebounceTimer)

  // Kicks off a call the the Simbad2k API to get the RA and DEC for the object
  if(filters.value.search.value){
    filtersDebounceTimer = setTimeout(async () => {
      const url = `https://simbad2k.lco.global/${filters.value.search.value}`
      await fetchApiCall({url: url, method: 'GET', successCallback: (data)=> {
        if(data.error){
          alertsStore.setAlert('warning', `Simbad ${data.error}`)
        }
        else if(data.eccentricity){
          alertsStore.setAlert('warning', 'LCO archive doesn\'t support Non-Sidereal target lookup')
        }
        else{
          filters.value.ra.value = data.ra_d
          filters.value.dec.value = data.dec_d
        }
      }})
    }, FILTER_DEBOUNCE)
  }
  else{
    filters.value.ra.value = null
    filters.value.dec.value = null
  }
})

onMounted(() => {
  // Check so Explore@PTR can open the relevant proposal
  if(route.query.proposal_id){
    const proposalIndexToOpen = userDataStore.proposals.findIndex(proposal => proposal.id == route.query.proposal_id)
    if(proposalIndexToOpen != -1)
      userDataStore.openProposals = [proposalIndexToOpen]
    else
      alertsStore.setAlert('warning', `Proposal ${route.query.proposal_id} not found in users proposals`)
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
      v-model="filters.start.value"
      :max="filters.end.value"
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
      v-model="filters.end.value"
      :max="new Date()"
      :min="filters.start.value"
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
      v-for="filter in Object.values(filters).filter(f => f.label && f.type !='hidden')"
      :key="filter.label"
      v-model="filter.value"
      :class="filter.class || ''"
      :label="filter.label"
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
          <div class="d-flex ga-2 mb-2">
            <v-chip
              v-for="filter in Object.values(filters).filter(f => f.value && f.label)"
              :key="filter.label"
              closable
              color="var(--primary-interactive)"
              text-color="var(--text)"
              :text="`${filter.label}: ${filter.value}`"
              @click:close="filter.value = ''"
            />
          </div>
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
            class="mt-4 d-flex flex-column justify-center align-center"
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
