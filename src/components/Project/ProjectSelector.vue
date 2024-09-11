<script setup>
import { defineProps } from 'vue'

defineProps({
  project: {
    type: Object,
    required: true
  }
})

</script>

<template>
  <v-expansion-panel>
    <v-expansion-panel-title
      icon="chevron-down"
      class="projects_title"
    >
      {{ project.id }}
    </v-expansion-panel-title>
    <v-expansion-panel-text>
      <p class="project_description">
        {{ project.title }}
      </p>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<style scoped>
.projects_title {
  letter-spacing: 0.1rem;
  font-size: 1rem;
  font-weight: 500; 
  background-color: var(--metal);
}
.project_description {
  font-size: 1.3rem;
  font-weight: 500;
  text-align: left;
}

@media (max-width: 1200px) {
  .projects_title {
    font-size: 1.1rem;
  }
  .project_description {
    font-size: 0.9rem;
  }
}
@media (max-width: 900px) {
  .projects_title {
    letter-spacing: 0.1rem;
    font-size: 0.9rem;
    font-weight: 500; 
  }
}
</style>
