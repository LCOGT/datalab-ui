<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'
import { fetchApiCall, handleError } from '@/utils/api'
import LoadBarButton from '@/components/DataSession/LoadBarButton.vue'
import DeleteOperationDialog from '@/components/Global/DeleteOperationDialog.vue'
import _ from 'lodash'

const store = useConfigurationStore()
const alertStore = useAlertsStore()
const emit = defineEmits(['operationCompleted', 'selectOperation', 'deleteOperation', 'operationWasDeleted', 'viewGraph'])

const props = defineProps({
  operations: {
    type: Array,
    required: true
  },
  sessionId: {
    type: Number,
    required: true
  },
  selectedOperation: {
    type: Number,
    required: true
  },
  active: {
    type: Boolean,
    required: true
  }
})

const operationPollingTimers = {}
const operationPercentages = ref({})
const deleteOperations = ref([])
const showDeleteDialog = ref(false)
const POLL_WAIT_TIME = 2000
const DEC_TO_PERCENT = 100
const COMPLETE_PERCENT = 100

function selectOperation(id) {
  emit('selectOperation', id)
}

async function pollOperationCompletion(operationID) {
  // Success Callback for checking operation status
  const updateOperationStatus = (response) => {
    if(response){
      switch(response.status){
      case 'PENDING':
        break
      case 'IN_PROGRESS':
        operationPercentages.value[operationID] = response.operation_progress * DEC_TO_PERCENT
        break
      case 'COMPLETED':
        operationPercentages.value[operationID] = COMPLETE_PERCENT
        emit('operationCompleted', response)
        clearPolling(operationID)
        break
      case 'FAILED':
        alertStore.setAlert('error', response.message ? response.message : 'Failed', 'Operation Error:')
        operationPercentages.value[operationID] = COMPLETE_PERCENT
        emit('deleteOperation', operationID)
        clearPolling(operationID)
        break
      default:
        console.error('Unknown Operation Status:', response.status)
      }
    }
    else{
      alertStore.setAlert('error', 'Operation status not found')
    }
  }

  const url = store.datalabApiBaseUrl + 'datasessions/' + props.sessionId + '/operations/' + operationID + '/'
  await fetchApiCall({ url: url, method: 'GET', successCallback: updateOperationStatus, failCallback: handleError })
}

function clearPolling(operationID) {
  if (operationID in operationPollingTimers){
    clearInterval(operationPollingTimers[operationID])
    delete operationPollingTimers[operationID]
  }
}

function clearAllPolling() {
  Object.keys(operationPollingTimers).forEach(operationID => {
    clearPolling(operationID)
  })
}

function recursiveFindChildren(operationId, childOperationIds = new Set()) {
  props.operations.forEach((operation) => {
    if (operation.dependencies.has(operationId)) {
      childOperationIds.add(operation.id)
      recursiveFindChildren(operation.id, childOperationIds)
    }
  })
  return
}

function openDeleteOperationDialog(operation) {
  let childrenIds = new Set()
  recursiveFindChildren(operation.id, childrenIds)
  childrenIds.add(operation.id)
  deleteOperations.value = _.filter(props.operations, function(o) {return childrenIds.has(o.id)})
  showDeleteDialog.value = true
}

function itemDeleted(){
  // Reset the selected operation after its deleted, otherwise the next operation will be selected 
  clearAllPolling()
  emit('selectOperation', -1)
  emit('operationWasDeleted')
}

watch(() => props.operations, () => {
  if (props.active) {
    props.operations.forEach(operation => {
      if (!operationPollingTimers[operation.id]) {
        // call once so buttons progress is updated immediately
        pollOperationCompletion(operation.id)
        if (operation.status == 'PENDING' || operation.status == 'IN_PROGRESS'){
          operationPollingTimers[operation.id] = setInterval(() => pollOperationCompletion(operation.id), POLL_WAIT_TIME)
        }
      }
    })
  }
})

watch(
  () => props.active, (active, previousActive) => {
    if (active && !previousActive) {
      props.operations.forEach(operation => {
        if (!operationPollingTimers[operation.id]) {
          // call once so buttons progress is updated immediately
          pollOperationCompletion(operation.id)
          if (operation.status == 'PENDING' || operation.status == 'IN_PROGRESS'){
            operationPollingTimers[operation.id] = setInterval(() => pollOperationCompletion(operation.id), POLL_WAIT_TIME)
          }
        }
      })
    }
    else {
      clearAllPolling()
    }
  }, { immediate: true }
)

onBeforeUnmount(() => {
  // Clean up Polling Intervals
  clearAllPolling()
})

</script>
<template>
  <h3 class="operations">
    OPERATIONS
    <v-btn
      variant="plain"
      color="var(--light-blue)"
      density="compact"
      icon="mdi-graph-outline"
      title="View Operations Graph"
      @click="emit('viewGraph')"
    />
  </h3>
  <v-row
    v-for="operation in operations"
    :key="operation.id"
    justify="center"
    class="operation mb-2"
  >
    <load-bar-button
      :class="{selected: operation.id == props.selectedOperation}"
      class="operation_button"
      :progress="operationPercentages[operation.id] ?? 0"
      @click="selectOperation(operation.id)"
    >
      <p>
        {{ operation.index }}: {{ operation.name }}
      </p>
    </load-bar-button>
    <v-slide-x-transition hide-on-leave>
      <v-btn
        v-if="operation.id == props.selectedOperation"
        variant="plain"
        icon="mdi-close"
        color="var(--cancel)"
        @click="openDeleteOperationDialog(operation)"
      />
    </v-slide-x-transition>
  </v-row>
  <delete-operation-dialog
    v-model="showDeleteDialog"
    :session-id="sessionId"
    :operations="deleteOperations"
    @item-was-deleted="itemDeleted()"
  />
</template>

<style scoped>
.operations {
  color: var(--tan);
  letter-spacing: 0.05rem;
  font-size: 2rem;
}

.operation{
  margin-top: 1rem;
}

.operation_button {
  width: 12rem;
  height: 3rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--metal);
}

@media (max-width: 1200px) {
  .operations {
    font-size: 1.3rem;
  }

  .addop_button {
    font-size: 1rem;
    height: 5vh;
  }

  .operation_button {
    width: 13vw;
    height: 4.5vh;
    font-size: 0.8rem;
  }
}

@media (max-width: 900px) {
  .operations {
    font-size: 1.2rem;
  }

  .addop_button {
    font-size: 0.9rem;
    height: 4vh;
  }

  .operation_button {
    width: 15vw;
    height: 3vh;
    font-size: 0.7rem;
  }
}
</style>
