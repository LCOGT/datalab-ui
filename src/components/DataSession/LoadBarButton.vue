<script setup>
defineProps({
  progress: {
    type: Number,
    required: true,
  }
})

</script>

<template>
  <v-btn class="loadBarButton">
    <slot />
    <div
      class="progress-bar"
      :style="{ width: progress + '%' }"
    />
  </v-btn>
</template>
<style scoped>
.loadBarButton{
  position: relative;
  overflow: hidden;
  background-color: var(--dark-blue);
}
:slotted(p) {
  z-index: 2;
}
.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--tan);
  height: 100%;
  transition: 0.3s;
  }

.selected .progress-bar {
  background-color: var(--dark-green);
}
</style>
