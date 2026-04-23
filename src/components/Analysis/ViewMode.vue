<script setup>
import { ref, watch } from 'vue'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'

const emit = defineEmits(['previous', 'next'])

const props = defineProps({
  image: {
    type: Object,
    required: true
  }
})

const imageUrl = ref(null)
const loading = ref(false)
const touchStartX = ref(null)
const retryingBasename = ref('')
const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()

function imageArchiveSource(image) {
  if (image?.source && image.source !== 'archive') {
    return image.source
  }
  return configurationStore.archiveType
}

async function fetchThumbnail(image) {
  loading.value = true
  try {
    if (image?.largeCachedUrl) {
      imageUrl.value = image.largeCachedUrl
      return
    }

    const url = image?.large_url || image?.largeThumbUrl || ''
    imageUrl.value = await thumbnailsStore.cacheImage(
      'large',
      imageArchiveSource(image),
      url,
      image?.basename || '',
    )
  } catch (e) {
    imageUrl.value = null
  } finally {
    if (!imageUrl.value) {
      loading.value = false
    }
  }
}

watch(() => props.image, (image) => {
  retryingBasename.value = ''
  if (image?.basename) fetchThumbnail(image)
  else imageUrl.value = null
}, { deep: true, immediate: true })

function showPrev() {
  emit('previous')
}
function showNext() {
  emit('next')
}

function handleTouchStart(event) {
  touchStartX.value = event.changedTouches[0]?.clientX ?? null
}

function handleTouchEnd(event) {
  if (touchStartX.value == null) return

  const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX.value
  const deltaX = touchEndX - touchStartX.value
  touchStartX.value = null

  if (Math.abs(deltaX) < 40) return

  if (deltaX < 0) {
    showNext()
  } else {
    showPrev()
  }
}

async function handleImageError() {
  if (!props.image?.basename || retryingBasename.value === props.image.basename) {
    imageUrl.value = null
    return
  }

  retryingBasename.value = props.image.basename
  thumbnailsStore.invalidateCachedImage('large', props.image.basename)

  const url = props.image?.large_url || props.image?.largeThumbUrl || ''
  imageUrl.value = await thumbnailsStore.cacheImage(
    'large',
    imageArchiveSource(props.image),
    url,
    props.image.basename,
  )
}

function doneLoadingImage() {
  loading.value = false
}
</script>

<template>
  <div class="viewmode-container">
    <v-btn
      icon="mdi-chevron-left"
      @click="showPrev"
    />
    <div
      class="image-wrapper"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <v-progress-circular
        v-if="loading"
        indeterminate
        color="primary"
        class="image-loading-spinner"
      />
      <img
        v-if="imageUrl"
        crossorigin="anonymous"
        :src="imageUrl"
        alt="Thumbnail"
        class="thumbnail-img"
        :class="{ 'thumbnail-img--loading': loading }"
        @load="doneLoadingImage"
        @error="handleImageError"
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
  position: relative;
}
.thumbnail-img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.thumbnail-img--loading {
  visibility: hidden;
}
.image-loading-spinner {
  position: absolute;
}
.no-image {
  color: var(--text);
  font-size: 1.2rem;
  text-align: center;
}
</style>
