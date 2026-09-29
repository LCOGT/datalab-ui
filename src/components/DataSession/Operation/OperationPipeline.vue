<script setup>
import { ref } from 'vue'
import LoadBarButton from '@/components/DataSession/LoadBarButton.vue'
import DeleteOperationDialog from '@/components/Global/DeleteOperationDialog.vue'

const emit = defineEmits(['selectOperation', 'operationWasDeleted'])

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

// Reset the selected operation after its deleted, otherwise the next operation will be selected 
function itemDeleted(deletedIds) {
  emit('selectOperation', -1)
  emit('operationWasDeleted', deletedIds)
}

</script>
<template>
  <v-row
    v-for="operation in operations"
    :key="operation.id"
    class="operation mb-2"
    :class="{selected: operation.id == props.selectedOperation}"
  >
    <load-bar-button
      :progress="operation.operation_progress ?? 0"
      :state="operation.state"
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
/* Selection is marked with an outline around the row so it frames the
   operation and its delete button.
*/
.operation.selected {
  outline: 2px solid var(--secondary-interactive);
  outline-offset: 4px;
  border-radius: 6px;
}

.delete-operation-button{
  margin-top: 0.5rem;
  justify-content: flex-start;
}
</style>
