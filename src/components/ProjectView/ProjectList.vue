<script setup>
import { ref } from "vue";
import ProjectImages from "./ProjectImages.vue";
import ProjectBar from "./ProjectBar.vue";

let selectedProject = ref("no project selected");

const handleProjectSelection = (projectTitle) => {
  selectedProject.value = projectTitle;
};
</script>

<template>
  <div class="project-bar-wrapper">
    <ProjectBar
      @update:selectedProject="handleProjectSelection"
      class="project-bar"
    />
    <ProjectImages
      class="h-auto w-75 pa-6 ma-1 project-images"
      :selectedProject="selectedProject"
    />
  </div>
</template>

<style scoped>
.project-bar-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.project-bar {
  width: 26%;
  margin: 0;
  padding: 2%;
}
.project-images {
  width: 70%;
  margin: 0;
  padding: 0;
}
</style>
