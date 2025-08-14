<script setup>
import ImageDownloadMenu from '@/components/Global/ImageDownloadMenu.vue'
import FilterBadge from './FilterBadge.vue'

const props = defineProps({
  image: {
    type: Object,
    default: () => {}
  },
  imageUrl: {
    type: String,
    default: ''
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  enableImageCards: {
    type: Boolean,
    default: true
  },
  enableRemoval: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['selectImage', 'launchAnalysis', 'removeImage'])

</script>
<template>
  <v-sheet
    v-if="props.imageUrl"
    :key="props.imageUrl"
    class="pa-1 annotated-image"
    color="var(--secondary-background)"
    :elevation="2"
    rounded
    :class="{ 'selected-image': isSelected }"
    @click="emit('selectImage', props.image.basename)"
  >
    <v-img
      :src="props.imageUrl"
      :alt="props.image.basename"
      rounded
      cover
      aspect-ratio="1"
      ondragstart="return false;"
    >
      <filter-badge
        v-if="props.image.filter || props.image.FILTER"
        :filter="props.image.filter || props.image.FILTER"
      />
      <span
        v-if="'operationIndex' in image"
        class="image-text-overlay"
      >{{ props.image.operationIndex }}</span>
      <span
        v-if="props.enableRemoval"
        class="removal-button-overlay"
      >
        <v-btn
          density="compact"
          icon="mdi-close"
          @click="emit('removeImage', props.image)"
        />
      </span>
    </v-img>
    <div
      v-if="props.enableImageCards"
      class="d-flex flex-row ga-2 align-center mt-2"
    >
      <p class="text-subtitle-2 mr-auto prevent-select single-line-text">
        {{ props.image.target_name || props.image.operationName }}
      </p>
      <v-icon
        icon="mdi-eye"
        color="var(--primary-interactive)"
        @click.stop="emit('launchAnalysis', props.image)"
      />
      <image-download-menu
        :fits-url="props.image.url || props.image.fits_url || ''"
        :jpg-url="props.image.largeCachedUrl || props.image.large_url || ''"
        :image-name="props.image.basename"
        speed-dial-location="top right"
        :enable-scaled-download="false"
      />
    </div>
  </v-sheet>
  <v-skeleton-loader
    v-else
    type="card"
    color="var(--secondary-background)"
    bg-color="var(--primary-background)"
  />
</template>

<style scoped>
.annotated-image {
  max-width: 200px;
  min-width: 120px;
  width: 100%;
}

.selected-image {
  outline: 0.3rem solid var(--primary-interactive);
}
.image-text-overlay {
  color: var(--text);
  font-weight: bold;
  margin-right: 5px;
  float: right;
}
.removal-button-overlay {
  color: var(--text);
  font-weight: bold;
  right: 5px;
  bottom: 5px;
  position: absolute;
}
</style>
