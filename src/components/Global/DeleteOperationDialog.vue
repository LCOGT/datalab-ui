<script setup>
import { deleteOperations } from '../../utils/api'
import DeleteDialog from '@/components/Global/DeleteDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  operations: {
    type: Array,
    required: true
  },
  sessionId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'itemWasDeleted'])

const DIALOG_TITLE = 'DELETE OPERATION(S)'
const DIALOG_BODY = 'Are you sure you want to delete this Datalab Operation and all dependent Operations?'

function itemDeleted(){
  const deletedIds = props.operations.map(op => op.id)
  emit('itemWasDeleted', deletedIds)
  emit('update:modelValue', false)
}

</script>
<template>
  <!-- Shared dialog used to confirm deleting of operations -->
  <delete-dialog
    :model-value="modelValue"
    :dialog-title="DIALOG_TITLE"
    :on-delete="() => {deleteOperations(props.sessionId, props.operations.map(op => op.id), itemDeleted)}"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p>{{ DIALOG_BODY }}</p>
    <br>
    <p>Included Operations:</p>
    <ul class="ml-8">
      <li
        v-for="operation in operations"
        :key="operation.id"
      >
        Operation {{ operation.index }} - {{ operation.name }}
      </li>
    </ul>
    <br>
    <p>This is not reversible!</p>
  </delete-dialog>
</template>

<style scoped>
</style>
