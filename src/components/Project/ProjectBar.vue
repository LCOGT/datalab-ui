<script setup>
import { defineEmits, defineProps, ref, computed, watch } from 'vue'
import ProjectSelector from './ProjectSelector.vue'
import { useSettingsStore } from '@/stores/settings'


const settingsStore = useSettingsStore()
const searchQuery = ref('')
const selectedProjectIndex = ref(0)
const dateNumber = ref(1)
const dateUnits = ref('Days')
const emit = defineEmits(['selectedProject'])

// Projects is an array of Objects containing 'id', 'title', and 'current' (boolean)
// This comes directly from the users profile
const props = defineProps({
  projects: {
    type: Array,
    required: true
  }
})

// filtering projects by proposal_id
const filteredProjects = computed(() => {
  if (searchQuery.value) {
    return props.projects.filter(project => project.id.includes(searchQuery.value))
  }
  return props.projects
})

const selectProject = (project) => {
  emit('selectedProject', project.id)
}

function dateMultiplier(units){
  switch (units) {
  case 'Days':
    return 1
  case 'Weeks':
    return 7
  case 'Months':
    return 31
  }
  return 1
}

function setDateRange(number, units) {
  let daysEnd = (number - 1) * dateMultiplier(units)
  let daysStart = number * dateMultiplier(units)
  settingsStore.endDate = new Date(Date.now() - 24 * 3600 * 1000 * daysEnd)
  settingsStore.startDate = new Date(Date.now() - 24 * 3600 * 1000 * daysStart)
}

watch(dateNumber, (newNumber) => {
  setDateRange(newNumber, dateUnits.value)
})

watch(dateUnits, (newUnits) => {
  setDateRange(dateNumber.value, newUnits)
})

</script>

<template>
  <div class="column is-one-quarter">
    <v-card class="h-auto w-20 ma-1 project_card">
      <p class="project_header">
        PROJECTS
      </p>
      <!-- This should be done in a more flexible way so it can collapse better on smaller screens -->
      <v-row class="mt-1">
        <v-col
          cols="4"
          class="ml-1"
        >
          <v-select
            v-model="dateNumber"
            :items="[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]"
            density="compact"
          />
        </v-col>
        <v-col cols="5">
          <v-select
            v-model="dateUnits"
            :items="['Days', 'Weeks', 'Months']"
            density="compact"
          />
        </v-col>
        <v-col
          class="mb-4"
          style="align-self: center;"
        >
          <b>Ago</b>
        </v-col>
      </v-row>
      <v-text-field
        v-model="searchQuery"
        append-inner-icon="mdi-magnify"
        density="compact"
        label="Search for a project"
        variant="solo"
        hide-details
        single-line
      />
      <v-expansion-panels
        v-model="selectedProjectIndex"
        variant="accordion"
        class="accordion"
      >
        <ProjectSelector
          v-for="(project, index) in filteredProjects"
          :key="index"
          :project="project"
          @click="selectProject(project)"
        />
      </v-expansion-panels>
    </v-card>
  </div>
</template>

<style scoped>
.project_bar {
  padding: 2em 1em;
}
.project_card {
  background-color: var(--metal);
  width: 15vw;
}
.project_header { 
  letter-spacing: 0.1rem;
  font-size: 1.7rem;
  font-weight: 600;
  text-align: center;
  padding: 2rem;
  color: var(--tan);
}
@media (max-width: 1200px) {
  .project_bar {
    padding: 0.5rem 0;
    height: 70%;
  }
  .project_header { 
    font-size: 1.4rem;
  }
}
@media (max-width: 900px) {
  .project_header {
    font-size: 1.1rem;
    padding: 0.3rem 0;
  }
}
</style>
