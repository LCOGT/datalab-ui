<script setup>
import { defineProps, defineEmits, computed } from 'vue'
import { deleteOperations } from '../../utils/api'
import DeleteDialog from '@/components/Global/DeleteDialog.vue'
import _ from 'lodash'

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

function itemDeleted(){
  emit('itemWasDeleted', props.operationId)
  emit('update:modelValue', false)
}

const bodyText = computed(() => {
  const DIALOG_BODY1 = 'Are you sure you want to delete this Datalab Operation and all dependent Operations?<br><br>Included Operations:<br><ul class="ml-8">'
  var text = DIALOG_BODY1
  props.operations.forEach((operation) => {
    text += '<li>Operation ' + operation.index + ' - ' + operation.name + '</li>'
  })
  text += '</ul><br>This is not reversible!'
  return text
})

</script>
<template>
  <!-- Shared dialog used to confirm deleting of operations -->
  <delete-dialog
    :model-value="modelValue"
    :dialog-title="DIALOG_TITLE"
    :dialog-body="bodyText"
    :on-delete="() => {deleteOperations(props.sessionId, _.map(props.operations, 'id'), itemDeleted)}"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
</style>
