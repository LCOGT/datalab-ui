<script setup>
import {computed} from 'vue'

const props = defineProps({
  progress: {
    type: Number,
    required: true,
  },
  state: {
    type: String,
    required: true
  },
  error: {
    type: String,
    required: false,
    default: ''
  }
})

const progressPercent = computed(() => {
  return props.error ? 100.0: props.progress * 100.0
})

const progressClass = computed(() => {
  return props.error ? 'progress-bar error-progress-bar': 'progress-bar good-progress-bar'
})

</script>

<template>
  <v-btn class="loadBarButton">
    <v-tooltip v-if="props.error" activator="parent" location="bottom">{{ props.error }}</v-tooltip>
    <slot/>
    <div
      :class="progressClass"
      :style="{ width: progressPercent + '%' }"
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
  height: 100%;
  transition: 0.3s;
}

.error-progress-bar {
  background-color: var(--cancel);
}

.good-progress-bar {
  background-color: var(--tan);
  }

.selected .good-progress-bar {
  background-color: var(--dark-green);
}

:slotted(.operate-button-in-progress) {
  background: linear-gradient(90deg, rgb(245, 118, 0),  rgb(255,90,95), rgb(255, 0, 0));
  background-size: 200%, auto;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: gradient-shift 3s infinite linear;
}

:slotted(.operate-button-pending) {
  color: var(--light-gray)
}

@keyframes gradient-shift {
  0%{
    background-position: 200% 50%;
  }

  100%{
    background-position: 0% 50%;
  }
}
</style>
