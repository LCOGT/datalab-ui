<script setup>
import { ref, defineProps, watch } from 'vue'
import OperationPipeline from './OperationPipeline.vue'
import OperationPipelineFlow from './OperationGraph/OperationPipelineFlow.vue'
import { fetchApiCall, handleError } from '@/utils/api.js'
import { calculateColumnSpan } from '@/utils/common'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import ImageGrid from '@/components/Global/ImageGrid.vue'
import OperationWizard from '@/components/DataSession/OperationWizard.vue'
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
const alertStore = useAlertsStore()

const operations = ref([...props.data.operations])
const images = ref([...props.data.input_data])
const filteredImages = ref([...images.value])
const showWizardDialog = ref(false)
const tab = ref('main')
const operationPollingTimers = {}

const dataSessionsUrl = store.datalabApiBaseUrl + 'datasessions/'
const imagesPerRow = 4
const POLL_WAIT_TIME = 5000

var operationMap = {}
var selectedOperation = ref(-1)

function imagesContainsFile(file) {
  return images.value.some(image => image.basename == file.basename && image.source == file.source && image.operation == file.operation)
}

function addCompletedOperation(operation) {
  if ('output' in operation && 'output_files' in operation.output) {
    operation.output.output_files.forEach(outputFile => {
      outputFile.operation = operation.id
      outputFile.operationIndex = operation.index
      if (!imagesContainsFile(outputFile)) {
        images.value.push(outputFile)
        if (selectedOperation.value == -1 || selectedOperation.value == outputFile.operation) {
          filteredImages.value.push(outputFile)
        }
      }
    })
  }
}

function selectOperation(operationId) {
  if (operationId == selectedOperation.value) {
    selectedOperation.value = -1
  }
  else {
    selectedOperation.value = operationId
  }
  reconcileFilteredImages()
}

function reconcileFilteredImages() {
  // This updates the filteredImages after changes in the operations list, or changes in selection of an operation.
  if (selectedOperation.value == -1) {
    filteredImages.value = [...images.value]
  }
  else {
    filteredImages.value = images.value.filter(image => image.operation == selectedOperation.value)
  }
}

async function addOperation(operationDefinition) {
  const url = dataSessionsUrl + props.data.id + '/operations/'

  // first operation doesn't load unless this is here
  function postOperationSuccess() {
    refreshOperations()
  }

  await fetchApiCall({ url: url, method: 'POST', body: operationDefinition, successCallback: postOperationSuccess, failCallback: handleError })
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
      if (_.isArray(inputParam)) {
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

function clearPolling(operationID) {
  if (operationID in operationPollingTimers){
    clearInterval(operationPollingTimers[operationID])
    delete operationPollingTimers[operationID]
  }
}

async function pollOperationCompletion(operation) {
  // Success Callback for checking operation status
  const updateOperationStatus = (response) => {
    // Copy over the updated status into the operation
    operationMap[response.id].status = response.status
    operationMap[response.id].operation_progress = response.operation_progress
    operationMap[response.id].output = response.output
    operationMap[response.id].message = response.message
    if(response){
      switch(response.status){
      case 'PENDING':
        break
      case 'IN_PROGRESS':
        break
      case 'COMPLETED':
        addCompletedOperation(operationMap[response.id])
        clearPolling(response.id)
        // Trigger use to attempt to start polling again for any dependent operations
        startOperationPolling()
        break
      case 'FAILED':
        alertStore.setAlert('error', response.message ? response.message : 'Failed', 'Operation Error:')
        clearPolling(response.id)
        break
      default:
        console.error('Unknown Operation Status:', response.status)
      }
    }
    else{
      alertStore.setAlert('error', 'Operation status not found')
    }
  }
  const url = store.datalabApiBaseUrl + 'datasessions/' + props.data.id + '/operations/' + operation.id + '/'
  await fetchApiCall({ url: url, method: 'GET', successCallback: updateOperationStatus, failCallback: handleError })
}

function startOperationPolling() {
  operations.value.forEach(operation => {
    if (operation.status != 'COMPLETED') {
      if (_.every(Array.from(operation.dependencies), function(id) {
        return id in operationMap && operationMap[id].status == 'COMPLETED'
      })){
        if (!operationPollingTimers[operation.id]) {
          operationPollingTimers[operation.id] = setInterval(() => pollOperationCompletion(operation), POLL_WAIT_TIME)
        }
      }
    }
  })
}

function stopOperationPolling() {
  Object.keys(operationPollingTimers).forEach(operationID => {
    clearPolling(operationID)
  })
}

// This triggers us to just get the operations for a datasession
async function refreshOperations() {
  const url = dataSessionsUrl + props.data.id + '/operations/'

  function onRefreshOperations(response) {
    operations.value = response.results
    processOperations()
    operations.value.forEach(operation => {
      if (operation.status == 'COMPLETED') {
        addCompletedOperation(operation)
      }
    })
    startOperationPolling()
  }

  await fetchApiCall({ url: url, method: 'GET', successCallback: onRefreshOperations, failCallback: handleError })
}

watch(
  () => props.active, (active, previousActive) => {
    if (active && !previousActive) {
      // If this tab becomes active, begin our process of polling for
      // non-completed operations. First get all the operations state.
      refreshOperations()
    }
    else {
      // If this tab becomes inactive from active, then make sure we stop
      // polling for operation changes
      stopOperationPolling()
    }
  }, { immediate: true }
)

</script>

<template>
  <v-card>
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
            :images="images"
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
          >
            <!-- The operations bar list goes here -->
            <operation-pipeline
              :session-id="data.id"
              :operations="operations"
              :active="props.active"
              :selected-operation="selectedOperation"
              @operation-completed="addCompletedOperation"
              @select-operation="selectOperation"
              @operation-was-deleted="refreshOperations"
              @view-graph="tab = 'graph'"
            />
            <v-btn
              variant="flat"
              class="addop_button"
            >
              Add Operation
              <v-dialog
                v-model="showWizardDialog"
                activator="parent"
                fullscreen
                transition="dialog-bottom-transition"
              >
                <operation-wizard
                  :images="images"
                  @close-wizard="showWizardDialog = false"
                  @add-operation="addOperation"
                />
              </v-dialog>
            </v-btn>
          </v-col>
          <image-grid
            :images="filteredImages"
            :column-span="calculateColumnSpan(filteredImages.length, imagesPerRow)"
          />
        </v-container>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-card>
</template>

<style scoped>
.hide-tabs {
  height:0px;
}
.ds-container {
  background-color: var(--metal);
  display: flex;
}
.graph-container {
  padding: 0;
  height: 800px;
}
.addop_button {
  font-size: 1rem;
  align-content: center;
  background-color: var(--light-blue);
  font-weight: 700;
  color: var(--tan);
  margin-top: 1rem;
  padding: 25px
}
</style>
