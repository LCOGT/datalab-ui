<script setup>
import { ref, watch } from 'vue'
import { VDateInput } from 'vuetify/labs/VDateInput'
import { initializeDate } from '@/utils/common'
import { useConfigurationStore } from '@/stores/configuration'
import { useAnalysisStore } from '@/stores/analysis'
import { fetchApiCall } from '../../utils/api'

defineEmits(['closeDialog'])
const props = defineProps({
  coords: {
    type: Object,
    required: true,
  }
})

const configStore = useConfigurationStore()
const analysisStore = useAnalysisStore()

const startDate = ref(initializeDate('', -5))
const endDate = ref( initializeDate(''))
const matchingImages = ref(0)
let queryUrl = ''

watch([startDate, endDate], () => {
  const baseUrl = configStore.datalabArchiveApiUrl + 'frames/'
  const timeUrlParam = `start=${startDate.value.toISOString()}&end=${endDate.value.toISOString()}`
  const proposalUrlParam = `proposal_id=${analysisStore.imageProposalId}`
  const coversUrlParam = `covers=POINT(${props.coords.ra} ${props.coords.dec})`
  queryUrl = baseUrl + '?' + timeUrlParam + '&' + proposalUrlParam + '&' + coversUrlParam

  fetchApiCall({url: queryUrl, method: 'GET', 
    successCallback: (data) => {
      matchingImages.value = data.count
    },
    failCallback: (error) => {
      console.error('Failed to fetch frames:', error)
    }
  })
}, { immediate: true })

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
      {{ matchingImages }} Images in time range
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
        @click="console.log(queryUrl)"
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
