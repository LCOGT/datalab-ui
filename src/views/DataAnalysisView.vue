<script setup>
import { computed } from 'vue'
import FilterBadge from '@/components/Global/FilterBadge.vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: null,
  }
})

const emit = defineEmits(['closeAnalysisDialog'])

const title = computed(() => {
  let text = props.data?.operationName || 'Unknown'
  if (props.data?.source) {
    text += ': ' + props.data.source?.name
  }
  return text
})

</script>
<template>
  <v-sheet class="analysis-page">
    <v-toolbar
      class="analysis-toolbar"
      density="comfortable"
    >
      <filter-badge
        v-if="props.data.filter"
        :filter="props.data.filter"
        class="ml-2"
      />
      <v-toolbar-title :text="title" />
      <v-btn
        icon="mdi-close"
        color="var(--cancel)"
        @click="emit('closeAnalysisDialog')"
      />
    </v-toolbar>
    <div class="analysis-content">
    </div>
  </v-sheet>
</template>
<style scoped>
/* Main Sections */
.analysis-page{
  background-color: var(--primary-background);
  color: greenyellow;
  font-family: var(--font-stack);
  height: 100vh;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}
.analysis-toolbar{
  color: var(--text);
  background-color: var(--header);
}
.analysis-content{
  flex: 1;
  display: flex;
  flex-direction: row;
  padding: 0.5rem;
}
</style>
