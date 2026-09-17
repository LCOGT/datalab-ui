<script setup>
import { ref, watch, computed } from 'vue'
import OperationPipeline from './Operation/OperationPipeline.vue'
import OperationPipelineFlow from './OperationGraph/OperationPipelineFlow.vue'
import { fetchApiCall, handleError } from '@/utils/api.js'
import { calculateColumnSpan } from '@/utils/common'
import { useConfigurationStore } from '@/stores/configuration'
import OperationOutputGrid from '@/components/Global/OperationOutputGrid.vue'
import OperationWizard from '@/components/DataSession/Operation/OperationWizard.vue'
import _ from 'lodash'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    required: true
  }
})

const store = useConfigurationStore()

function sortByObservationDate(items) {
  return [...items].sort((a, b) => {
    return new Date(a.observation_date) - new Date(b.observation_date)
  })
}

const operations = ref([...props.data.operations])
const items = ref(sortByObservationDate(props.data.input_data))
const showWizardDialog = ref(false)
const tab = ref('main')
const operationPollingTimers = {}
const selectedOperation = ref(-1)
const persist = ref(props.data.persist)
const dataSessionsUrl = store.datalabApiBaseUrl + 'datasessions/'
const IMAGES_PER_ROW = 4
const POLL_WAIT_TIME = 5000
const SESSION_RETENTION_DAYS = 30
const SNACKBAR_TIMEOUT = 5000

// Transient messages drained by the snackbar queue at the bottom of the session
const snackbarMessages = ref([])

var operationMap = {}

// When a user clicks on an operation, we filter to only show the outputs of that operation
const filteredImages = computed(() => {
  if (selectedOperation.value === -1) {
    return sortByObservationDate(items.value)
  } else {
    return sortByObservationDate(items.value.filter(item => item.operation === selectedOperation.value))
  }
})

const persistTitle = computed(() => {
  return persist.value
    ? 'This session persists indefinitely'
    : `This session will be deleted ${SESSION_RETENTION_DAYS} days after it was created`
})

// Pin/unpin the session so the cleanup job leaves it alone, reverting the icon if the update fails
async function updatePersist(value) {
  const previousPersist = persist.value
  persist.value = value
  await fetchApiCall({
    url: dataSessionsUrl + props.data.id + '/?response_fields=id,persist',
    method: 'PATCH',
    body: { persist: value },
    successCallback: (response) => {
      persist.value = response.persist
      snackbarMessages.value.push({ text: persistTitle.value, color: 'info' })
    },
    failCallback: (response, status) => {
      persist.value = previousPersist
      handleError(response, status)
    }
  })
}

// Queues an operation's current message, falling back to 'Failed' so a failure always
// reports even when the backend sends no message. Operations with nothing to say are skipped.
function addOperationMessage(operation) {
  const isFailure = operation.status == 'FAILED'
  const message = isFailure ? operation.message || 'Failed' : operation.message
  if (!message) return
  snackbarMessages.value.push({
    text: `${operation.name} Operation ${operation.index}: ${message}`,
    color: isFailure ? 'error' : 'info'
  })
}

// Runs when a user clicks on an operation to select/deselect it
function selectOperation(operationId) {
  if (operationId == selectedOperation.value) {
    selectedOperation.value = -1
  }
  else {
    selectedOperation.value = operationId
    // Re-show the message of an operation that hasn't finished or has failed to the snackbar.
    const operation = operationMap[operationId]
    if (operation && operation.status != 'COMPLETED') {
      addOperationMessage(operation)
    }
  }
}


// Output Equality Check
function itemsContainsOutput(output) {
  return items.value.some(item => _.isEqual(item, output))
}

// Add completed operation output to output items list and attach operation metadata to identify their source
function addCompletedOperation(operation) {
  const outputKeysToExpand = ['output_files', 'output_data']
  if ('output' in operation){
    for (const key of outputKeysToExpand) {
      if (key in operation.output) {
        operation.output[key].forEach(output => {
          output.operation = operation.id
          output.operationIndex = operation.index
          output.operationName = operation.name
          output.operationInputData = operation.input_data
          if (!itemsContainsOutput(output)) {
            items.value.push(output)
          }
        })
      }
    }
  }
}

async function addOperation(operationDefinition) {
  const url = dataSessionsUrl + props.data.id + '/operations/'
  await fetchApiCall({
    url: url,
    method: 'POST',
    body: operationDefinition,
    successCallback: refreshOperations,
    failCallback: handleError
  })
}

function stopPollingById(operationIDs) {
  const ids = Array.isArray(operationIDs) ? operationIDs : [operationIDs]

  ids.forEach(id => {
    if (operationPollingTimers[id]) {
      clearInterval(operationPollingTimers[id])
      delete operationPollingTimers[id]
    }
  })

  refreshOperations()
}

function operationDeleted(operationIDs){
  // Stop polling for deleted operations
  stopPollingById(operationIDs)
  // Remove outputFiles with matching operationIDs from output items
  items.value = items.value.filter(item => {
    return !operationIDs.some(id => item.operation == id)
  })
}

// Main lifecycle function for managing operation polling and updates
async function pollOperationCompletion(operation) {
  const url = store.datalabApiBaseUrl + 'datasessions/' + props.data.id + '/operations/' + operation.id + '/'
  const response = await fetchApiCall({
    url: url,
    method: 'GET',
    failCallback: handleError
  })
  if (response) {
    updateOperationStatus(response)
  }
}

function updateOperationStatus(response) {
  const operation = operationMap[response.id]
  const previousMessage = operation.message

  // Copy over the updated status into the operation
  operation.status = response.status
  operation.operation_progress = response.operation_progress
  operation.output = response.output
  operation.message = response.message

  // Surface each new message as polling picks it up, so progress is visible without opening
  // the operation. Progress messages only report when changed, but a failure always reports.
  if (response.status == 'FAILED' || response.message !== previousMessage) {
    addOperationMessage(operation)
  }

  switch(response.status){
  case 'PENDING':
    break
  case 'IN_PROGRESS':
    if (response.output){
      // This will add output as it is generated in progress
      addCompletedOperation(operation)
    }
    break
  case 'COMPLETED':
    addCompletedOperation(operation)
    stopPollingById(response.id)
    // Trigger use to attempt to start polling again for any dependent operations
    startOperationPolling()
    break
  case 'FAILED':
    console.error('[DataSession] operation failed', {
      id: response.id,
      name: response.name,
      message: response.message,
      response
    })
    stopPollingById(response.id)
    break
  default:
    console.error('Unknown Operation Status:', response.status)
  }
}

// Kicks off the lifecycle function above for any operations that are not completed
function startOperationPolling() {
  operations.value.forEach(operation => {
    if (operation.status != 'COMPLETED' && operation.status != 'FAILED') {
      if (Array.from(operation.dependencies).every(id =>
        id in operationMap && operationMap[id].status == 'COMPLETED'
      )){
        if (!operationPollingTimers[operation.id]) {
          operationPollingTimers[operation.id] = setInterval(() => pollOperationCompletion(operation), POLL_WAIT_TIME)
        }
      }
    }
  })
}

// This triggers us to just get the operations for a datasession
async function refreshOperations() {
  const url = dataSessionsUrl + props.data.id + '/operations/'
  const response = await fetchApiCall({ url: url, method: 'GET', failCallback: handleError })
  if (!response) return
  operations.value = response.results
  processOperations()
  operations.value.forEach(operation => {
    if (operation.status == 'COMPLETED') {
      addCompletedOperation(operation)
    }
  })
  startOperationPolling()
}

function processOperations() {
  // Look through the input_data for file arrays and set dependency set on each operation
  operationMap = {}
  operations.value.forEach((operation, index) => {
    operationMap[operation.id] = operation
    // Set the operation index based on its list position in the response (1 indexed)
    operation.index = index + 1
    operation.dependencies = new Set()
    Object.values(operation.input_data).forEach(inputParam => {
      if (Array.isArray(inputParam)) {
        inputParam.forEach(inputValue => {
          if (inputValue.basename && inputValue.source == 'datalab' && inputValue.operation) {
            // This operation depends on another operation so add that to dependencies
            operation.dependencies.add(inputValue.operation)
          }
        })
      }
    })
  })
}

watch(
  () => props.active, (active, previousActive) => {
    if (active && !previousActive) {
      // If this tab becomes active, begin our process of polling for
      // non-completed operations. First get all the operations state.
      refreshOperations()
    }
    else {
      // Stop all polling timers for inactive tabs
      Object.keys(operationPollingTimers).forEach(operationID => {
        stopPollingById(operationID)
      })
    }
  }, { immediate: true }
)

</script>

<template>
  <v-tabs
    v-model="tab"
    class="hide-tabs"
  >
    <v-tab
      value="graph"
      class="d-none"
    />
    <v-tab
      value="main"
      class="d-none"
    />
  </v-tabs>
  <v-tabs-window v-model="tab">
    <v-tabs-window-item value="graph">
      <v-container class="d-lg-flex ds-container graph-container">
        <operation-pipeline-flow
          :session-id="data.id"
          :operations="operations"
          :selected-operation="selectedOperation"
          :images="items"
          :active="props.active"
          @select-operation="selectOperation"
          @close-graph="tab = 'main'"
        />
      </v-container>
    </v-tabs-window-item>
    <v-tabs-window-item value="main">
      <v-container class="d-lg-flex ds-container">
        <v-col
          cols="3"
          align="center"
          class="operations-column"
        >
          <v-btn
            class="persist-button"
            variant="plain"
            color="var(--primary-interactive)"
            density="compact"
            :icon="persist ? 'mdi-pin' : 'mdi-pin-outline'"
            :title="persistTitle"
            @click="updatePersist(!persist)"
          />
          <h3 class="operations-title">
            OPERATIONS
            <v-btn
              variant="plain"
              color="var(--primary-interactive)"
              density="compact"
              icon="mdi-graph-outline"
              title="View Operations Graph"
              @click="tab = 'graph'"
            />
          </h3>
          <!-- The operations bar list goes here -->
          <operation-pipeline
            :session-id="data.id"
            :operations="operations"
            :active="props.active"
            :selected-operation="selectedOperation"
            @select-operation="selectOperation"
            @operation-was-deleted="operationDeleted"
          />
          <v-btn
            class="addop_button"
            prepend-icon="mdi-plus"
            text="Select Operation"
            @click="showWizardDialog = true"
          />
        </v-col>
        <operation-output-grid
          :operation-outputs="filteredImages"
          :column-span="calculateColumnSpan(filteredImages.length, IMAGES_PER_ROW)"
        />
      </v-container>
    </v-tabs-window-item>
  </v-tabs-window>
  <v-dialog
    v-model="showWizardDialog"
    fullscreen
    transition="dialog-bottom-transition"
    z-index="999"
  >
    <operation-wizard
      :data="items"
      @close-wizard="showWizardDialog = false"
      @add-operation="addOperation"
    />
  </v-dialog>
  <v-snackbar-queue
    v-model="snackbarMessages"
    :timeout="SNACKBAR_TIMEOUT"
  >
    <template #actions="{ props: closeProps }">
      <v-btn
        variant="plain"
        density="compact"
        icon="mdi-close"
        title="Dismiss"
        v-bind="closeProps"
      />
    </template>
  </v-snackbar-queue>
</template>

<style scoped>
.hide-tabs {
  height:0px;
}
.ds-container {
  background-color: var(--primary-background);
  display: flex;
}
.graph-container {
  padding: 0;
  height: 800px;
}
.operations-column {
  background-color: var(--card-background);
  /* Reduced top padding so the corner pin button sits just above the title
     rather than pushing it a full row down */
  padding: 0.75rem 2rem 2rem;
  margin-right: 1rem;
  border-radius: 10px;
  max-width: 300px;
  position: relative;
}
.operations-title {
  font-size: 1.5rem;
  color: var(--text);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.persist-button {
  position: absolute;
  top: 0.25rem;
  right: 0.1rem;
}
.addop_button {
  margin-top: 1.5rem;
  background-color: var(--primary-interactive);
  font-weight: 500;
  color: var(--text);
}
</style>
