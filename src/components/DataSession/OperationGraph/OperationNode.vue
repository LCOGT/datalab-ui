<script setup>
import LoadBarButton from '@/components/DataSession/LoadBarButton.vue'

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
</script>

<template>
  <load-bar-button
    :class="{selected: props.id == props.selectedId}"
    class="operation_button nodrag"
    :progress="props.data.operation_progress ?? 0"
    :status="props.data.status"
    :index="props.data.index"
    :text="props.data.name"
    :error="props.data.message ?? ''"
    @click="selectOperation(props.id)"
  />
</template>

<style scoped>
.operation_button {
  width: 12rem;
  height: 3rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}
</style>
