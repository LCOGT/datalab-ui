<script setup>
import { ref, watch } from 'vue'

const emit = defineEmits(['updateCurrentIndex'])

const props = defineProps({
  currentIndex: {
    type: Number,
    required: true
  },
  images: {
    type: Array,
    required: true
  }
})

const imageUrl = ref(null)
const loading = ref(false)

async function fetchThumbnail(basename) {
  loading.value = true
  try {
    const response = await fetch(`https://archive-api.lco.global/thumbnails/?frame_basename=${basename}&size=large`)
    const json = await response.json()
    imageUrl.value = json.results?.[0]?.url || null
  } catch (e) {
    imageUrl.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.currentIndex, (newIndex) => {
  const basename = props.images[newIndex]?.basename
  if (basename) fetchThumbnail(basename)
  else imageUrl.value = null
}, { immediate: true })

function showPrev() {
  if (props.currentIndex > 0) {
    emit('updateCurrentIndex', props.currentIndex - 1)
  }
}
function showNext() {
  if (props.currentIndex < props.images.length - 1) {
    emit('updateCurrentIndex', props.currentIndex + 1)
  }
}
</script>

<template>
  <div class="viewmode-container">
    <v-btn
      icon="mdi-chevron-left"
      :disabled="props.currentIndex === 0"
      @click="showPrev"
    />
    <div class="image-wrapper">
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
      />
      <img
        v-else-if="imageUrl"
        crossorigin="anonymous"
        :src="imageUrl"
        alt="Thumbnail"
        class="thumbnail-img"
      >
      <div
        v-else
        class="no-image"
      >
        No image available
      </div>
    </div>
    <v-btn
      icon="mdi-chevron-right"
      :disabled="props.currentIndex === props.images.length - 1"
      @click="showNext"
    />
  </div>
</template>

<style scoped>
.viewmode-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 1;
  width: 100%;
  height: 100%;
}
.image-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}
.thumbnail-img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.no-image {
  color: var(--text);
  font-size: 1.2rem;
  text-align: center;
}
</style>
