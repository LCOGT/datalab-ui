<script setup>
import { ref } from 'vue'
import LoadBarButton from '@/components/DataSession/LoadBarButton.vue'
import DeleteOperationDialog from '@/components/Global/DeleteOperationDialog.vue'
import _ from 'lodash'

const emit = defineEmits(['operationCompleted', 'selectOperation', 'operationWasDeleted', 'viewGraph'])

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

const deleteOperations = ref([])
const showDeleteDialog = ref(false)

function selectOperation(id) {
  emit('selectOperation', id)
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

function itemDeleted(deletedIds) {
  // Reset the selected operation after its deleted, otherwise the next operation will be selected 
  emit('selectOperation', -1)
  emit('operationWasDeleted', deletedIds)
}

function operationStateToClass(operation) {
  if (operation.status === 'PENDING') {
    return 'operate-button-pending'
  }
  else if (operation.status === 'IN_PROGRESS') {
    return 'operate-button-in-progress'
  }
  else {
    return ''
  }
}


</script>
<template>
  <h3 class="operations">
    OPERATIONS
    <v-btn
      variant="plain"
      color="var(--primary-interactive)"
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
      :progress="operation.operation_progress ?? 0"
      :state="operation.state"
      :error="operation.message ?? ''"
      @click="selectOperation(operation.id)"
    >
      <p :class="operationStateToClass(operation)">
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
    @item-was-deleted="itemDeleted"
  />
</template>

<style scoped>
.operations {
  color: var(--text);
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
  color: var(--text);
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
