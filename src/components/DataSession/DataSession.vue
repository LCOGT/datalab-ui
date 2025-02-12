<script setup>
import { ref, defineEmits, defineProps, onMounted, watch } from 'vue'
import OperationPipeline from './OperationPipeline.vue'
import OperationPipelineFlow from './OperationGraph/OperationPipelineFlow.vue'
import { fetchApiCall, handleError, deleteOperation } from '@/utils/api.js'
import { calculateColumnSpan } from '@/utils/common'
import { useConfigurationStore } from '@/stores/configuration'
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

const emit = defineEmits(['reloadSession'])
const images = ref([...props.data.input_data])
const filteredImages = ref([...images.value])
const showWizardDialog = ref(false)
const tab = ref('main')

const dataSessionsUrl = store.datalabApiBaseUrl + 'datasessions/'
const imagesPerRow = 4
var operationMap = {}
var selectedOperation = ref(-1)

async function addCompletedOperationsOutput() {
  const url = dataSessionsUrl + props.data.id + '/operations/'

  function updateCompletedOperations(response) {
    response.results.forEach(operationResponse => {
      if (operationResponse.status == 'COMPLETED') {
        addCompletedOperation(operationResponse)
      }
    })
    reconcileOperations()
  }

  await fetchApiCall({ url: url, method: 'GET', successCallback: updateCompletedOperations, failCallback: handleError })
}


function imagesContainsFile(file) {
  return images.value.some(image => image.basename == file.basename && image.source == file.source && image.operation == file.operation)
}


function addCompletedOperation(operationResponse) {
  if ('output' in operationResponse && 'output_files' in operationResponse.output) {
    operationResponse.output.output_files.forEach(outputFile => {
      outputFile.operation = operationResponse.id
      outputFile.operationIndex = operationMap[operationResponse.id]
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

function reconcileOperationImages() {
  // This updates the operationIndex of images after changes in the operations list
  images.value = images.value.filter(obj => !obj.operation || obj.operation in operationMap)
  images.value.forEach(image => {
    if (image.operation) {
      image.operationIndex = operationMap[image.operation]
    }
  })
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
    emit('reloadSession')
  }

  await fetchApiCall({ url: url, method: 'POST', body: operationDefinition, successCallback: postOperationSuccess, failCallback: handleError })
}

function reconcileOperations() {
  // This makes sure our operationMap mapping operation ids to indices is up to date following changes in the operation list
  operationMap = {}
  props.data.operations.forEach((operation, index) => {
    operationMap[operation.id] = index + 1
  })
  if (!(selectedOperation.value in operationMap)) {
    selectedOperation.value = -1
  }
  reconcileOperationImages()
}

watch(
  () => props.data.operations, () => {
    // Look through the input_data for file arrays and set dependency set on each operation
    props.data.operations.forEach((operation, index) => {
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
    reconcileOperations()
  },
  { immediate: true })

onMounted(() => {
  addCompletedOperationsOutput()
})

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
            :operations="data.operations"
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
              :operations="data.operations"
              :active="props.active"
              :selected-operation="selectedOperation"
              @operation-completed="addCompletedOperation"
              @select-operation="selectOperation"
              @operation-was-deleted="emit('reloadSession')"
              @delete-operation="(operationID) => deleteOperation(props.data.id, operationID, emit('reloadSession'))"
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
