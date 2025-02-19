<!-- eslint-disable vue/require-prop-types -->
<script setup>
import { defineProps, defineEmits } from 'vue'
import { fetchApiCall } from '../../utils/api'
import { useConfigurationStore } from '@/stores/configuration'
import DeleteDialog from '@/components/Global/DeleteDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  sessionId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'itemWasDeleted'])

const store = useConfigurationStore()

const dataSessionsUrl = store.datalabApiBaseUrl + 'datasessions/'
const DIALOG_TITLE = 'DELETE SESSION'
const DIALOG_BODY = 'Are you sure you want to delete this Datalab Session? This is not reversible!'

function itemDeleted(){
  emit('itemWasDeleted', props.sessionId)
  emit('update:modelValue', false)
}

async function confirmDeleteOperation() {
  const url = dataSessionsUrl + props.sessionId
  await fetchApiCall({url: url, method: 'DELETE', successCallback: itemDeleted })
}

</script>
<template>
  <!-- Shared dialog used to confirm deleting of operations -->
  <delete-dialog
    :model-value="modelValue"
    :dialog-title="DIALOG_TITLE"
    :dialog-body="DIALOG_BODY"
    :on-delete="confirmDeleteOperation"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
</style>
