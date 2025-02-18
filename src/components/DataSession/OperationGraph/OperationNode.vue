<script setup>
import LoadBarButton from '@/components/DataSession/LoadBarButton.vue'
import { defineEmits} from 'vue'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  selectedId: {
    type: Number,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['selectOperation'])

function selectOperation(index) {
  if (index == props.selectedId) {
    emit('selectOperation', -1)
  }
  else {
    emit('selectOperation', index)
  }
}

function operationStateToClass(state) {
  if (state === 'PENDING') {
    return 'operate-button-pending'
  }
  else if (state === 'IN_PROGRESS') {
    return 'operate-button-in-progress'
  }
  else {
    return ''
  }
}
</script>

<template>
  <load-bar-button
    :class="{selected: props.id == props.selectedId}"
    class="operation_button nodrag"
    :progress="props.data.operation_progress ?? 0"
    :state="props.data.status"
    :error="props.data.message ?? ''"
    @click="selectOperation(props.id)"
  >
    <p :class="operationStateToClass(props.data.status)">
      {{ props.data.index }}: {{ props.data.name }}
    </p>
  </load-bar-button>
</template>

<style scoped>
.operation_button {
  width: 12rem;
  height: 3rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--metal);
}
</style>
