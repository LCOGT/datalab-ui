<script setup>
import { computed, ref, watch } from 'vue'
import { VDateInput } from 'vuetify/labs/VDateInput'
import { useConfigurationStore } from '@/stores/configuration'
import { useAnalysisStore } from '@/stores/analysis'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall } from '../../utils/api'

const emit = defineEmits(['closeDialog', 'analysisAction'])

const props = defineProps({
  coords: {
    type: Object,
    required: true,
  }
})

const configStore = useConfigurationStore()
const analysisStore = useAnalysisStore()
const alertsStore = useAlertsStore()

const endDate = ref(new Date(analysisStore.headerData.DATE))
const startDate = ref(new Date(endDate.value))
startDate.value.setDate(endDate.value.getDate() - 7)
const matchingImages = ref({ count: 0, results: [] })

const ISOStartDate = computed(() => startDate.value.toISOString())
const ISOEndDate = computed(() => endDate.value.toISOString())

watch([startDate, endDate], () => {
  const { datalabArchiveApiUrl } = configStore
  const { imageFilter, imageProposalId } = analysisStore
  const { ra, dec } = props.coords

  const queryUrl = datalabArchiveApiUrl + 'frames/?' + 
    `start=${ISOStartDate.value}&end=${ISOEndDate.value}&` +
    `primary_optical_element=${imageFilter}&` +
    `proposal_id=${imageProposalId}&` +
    `covers=POINT(${ra} ${dec})`

  fetchApiCall({url: queryUrl, method: 'GET', 
    successCallback: (data) => {
      matchingImages.value = data
    },
    failCallback: (error) => {
      console.error('Failed to fetch frames:', error)
      alertsStore.setAlert('error', 'Failed to fetch frames from archive API')
    }
  })
}, { immediate: true })

function dispatchVariableAnalysis() {
  const variableStarActionName = 'variable-star'
  emit ('analysisAction', variableStarActionName, {
    images: matchingImages.value.results.map((image) => {
      return {
        id: image.id,
        basename: image.basename,
        observation_date: image.observation_date,
      }
    }),
    target_coords: props.coords,
  })
  analysisStore.lightCurveLoading = true
  emit('closeDialog')
}

</script>
<template>
  <v-card class="d-flex flex-column ga-4">
    <p>Variable Star Analysis</p>
    <div class="d-flex ga-6">
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
    </div>
    <p class="imageCountText">
      {{ matchingImages.count }} Images in date range
    </p>
    <div class="buttons d-flex ga-4 justify-end">
      <v-btn
        color="var(--cancel)"
        text="Cancel"
        @click="$emit('closeDialog')"
      />
      <v-btn
        color="var(--primary-interactive)"
        text="Analyze"
        @click="dispatchVariableAnalysis"
      />
    </div>
  </v-card>
</template>
<style scoped>
  .v-card {
    padding: 2rem;
    background-color: var(--card-background);
    color: var(--text);
  }
  .imageCountText {
    color: var(--info);
    font-style: italic;
  }
</style>
