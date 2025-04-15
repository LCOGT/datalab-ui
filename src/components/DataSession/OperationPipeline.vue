<script setup>
import { ref } from 'vue'
import LoadBarButton from '@/components/DataSession/LoadBarButton.vue'
import DeleteOperationDialog from '@/components/Global/DeleteOperationDialog.vue'

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
  deleteOperations.value = props.operations.filter(o => childrenIds.has(o.id))
  showDeleteDialog.value = true
}

function itemDeleted(deletedIds) {
  // Reset the selected operation after its deleted, otherwise the next operation will be selected 
  emit('selectOperation', -1)
  emit('operationWasDeleted', deletedIds)
}

</script>
<template>
  <h3 class="operations-title">
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
    class="operation mb-2"
  >
    <load-bar-button
      :class="{selected: operation.id == props.selectedOperation}"
      :progress="operation.operation_progress ?? 0"
      :state="operation.state"
      :error="operation.message ?? ''"
      :index="operation.index"
      :text="operation.name"
      :status="operation.status"
      @click="selectOperation(operation.id)"
    />
    <v-slide-x-transition hide-on-leave>
      <v-btn
        v-if="operation.id == props.selectedOperation"
        class="delete-operation-button"
        variant="text"
        size="small"
        prepend-icon="mdi-trash-can"
        text="Delete"
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
.operations-title {
  font-size: 1.5rem;
  color: var(--text);
  margin-bottom: 1.5rem;
}
.delete-operation-button{
  margin-top: 0.5rem;
  justify-content: flex-start;
}
</style>
