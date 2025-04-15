<script setup>
import {computed} from 'vue'

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    required: false,
    default: ''
  },
  progress: {
    type: Number,
    required: true,
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

const progressBg = computed(() => {
  return props.error ? 'progress-bar error-progress-bar' : 'progress-bar good-progress-bar'
})

const textClass = computed(() => {
  if (props.status === 'PENDING') {
    return 'operate-button-pending'
  } else if (props.status === 'IN_PROGRESS') {
    return 'operate-button-in-progress'
  } else {
    return ''
  }
})

</script>

<template>
  <v-btn class="loadBarButton">
    <v-tooltip
      v-if="props.error"
      activator="parent"
      location="bottom"
    >
      {{ props.error }}
    </v-tooltip>
    <p :class="textClass">
      {{ index + ". " + text }}
    </p>
    <div
      :class="progressBg"
      :style="{ width: progressPercent + '%' }"
    />
  </v-btn>
</template>
<style scoped>
.loadBarButton {
  position: relative;
  display: flex;
  width: 15vw;
  justify-content: flex-start;
  overflow: hidden;
  background-color: var(--secondary-background);
}

.loadBarButton p {
  position: relative;
  font-size: 0.8rem;
  font-weight: 600;
  z-index: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.3s;
  z-index: 1;
}

.error-progress-bar {
  background-color: var(--cancel);
}

.good-progress-bar {
  background-color: var(--primary-interactive);
}

.selected .good-progress-bar {
  background-color: var(--secondary-interactive);
}

.operate-button-in-progress {
  background: linear-gradient(90deg, #227d35, #43ae30, var(--success));
  background-size: 200% auto;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: gradient-shift 3s infinite linear;
}

.operate-button-pending {
  color: var(--disabled-text);
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
