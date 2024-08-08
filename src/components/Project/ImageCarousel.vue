
<script setup>
import { ref, defineProps, watch } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingsStore } from '@/stores/settings'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { Carousel, Slide } from 'vue3-carousel'
import 'vue3-carousel/dist/carousel.css'
import ImageAnalyzer from './ImageAnalysis/ImageAnalyzer.vue'
import FilterBadge from '@/components/Global/FilterBadge.vue'

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
})

const store = useSettingsStore()
const configurationStore = useConfigurationStore()
const thumbnailsStore = useThumbnailsStore()
const currentSlide = ref(0)
const currSmallImage = ref(null)
const currLargeImage = ref(null)
const showAnalysisDialog = ref(false)
const carousel = ref(null)
const breakpoints = {
  700: {
    itemsToShow: 3.5,
    snapAlign: 'center'
  },
  1024: {
    itemsToShow: 5
  },
  1600: {
    itemsToShow: 6
  },
  2000: {
    itemsToShow: 7
  },
  2400: {
    itemsToShow: 8
  },
  2800: {
    itemsToShow: 9
  },
  3200: {
    itemsToShow: 10
  },
}

const handleThumbnailClick = (item, index) => {
  store.toggleImageSelection(item)
  const lastSelectedImage = store.selectedImages.length > 0 ? store.selectedImages[store.selectedImages.length - 1] : null
  const isLastSelectedImageInCurrentProject = lastSelectedImage && props.data.some(img => img.basename === lastSelectedImage.basename)
  if (isLastSelectedImageInCurrentProject) {
    currSmallImage.value = lastSelectedImage
    currentSlide.value = props.data.findIndex(img => img.basename === currSmallImage.value.basename)
  } else {
    currentSlide.value = index
  }
  currLargeImage.value = currSmallImage.value
}


watch(currLargeImage, async (newValue) => {
  if (newValue){
    currLargeImage.value.largeCachedUrl = ref('')
    thumbnailsStore.cacheImage('large', configurationStore.archiveType, newValue.largeThumbUrl, newValue.basename).then((cachedUrl) => {
      currLargeImage.value.largeCachedUrl = cachedUrl
    })
  }
})


watch(() => props.data, (newVal) => {
  if (newVal && newVal.length > 0) {
    currSmallImage.value = newVal[0]
    currLargeImage.value = currSmallImage.value
  }
}, {
  immediate: true
})

</script>

<template>
  <!-- Main Carousel -->
  <Carousel
    id="gallery"
    v-model="currentSlide"
    :items-to-show="1"
    :wrap-around="false"
    :transition="0"
    class="big-image"
  >
    <Slide
      v-for="(item, index) in data"
      :key="index"
    >
      <div class="selected__item">
        <img
          v-if="currLargeImage"
          :src="currLargeImage.largeCachedUrl"
          class="selected__image"
          :alt="item.OBJECT"
          @click="showAnalysisDialog = true"
        >
      </div>
    </Slide>
  </Carousel>
  <Carousel
    id="thumbnails"
    ref="carousel"
    v-model="currentSlide"
    class="mt-4"
    :wrap-around="false"
    :breakpoints="breakpoints"
  >
    <Slide
      v-for="(item, index) in data"
      :key="index"
    >
      <div
        class="carousel__item"
        @click="handleThumbnailClick(item, index)"
      >
        <v-img
          :src="item.smallCachedUrl"
          loading="lazy"
          cover
          class="thumbnail__item"
          :class="{'selected-thumbnail': store.isSelected(item)}"
          :alt="item.OBJECT"
        >
          <filter-badge
            v-if="item.FILTER"
            :filter="item.FILTER"
          />
        </v-img>
      </div>
    </Slide>
  </Carousel>
  <image-analyzer
    v-model="showAnalysisDialog"
    :image="currLargeImage"
  />
</template>

<style scoped>
#gallery {
  height: auto;
}
.carousel__item {
  height: 200px;
  width:200px;
}
.big-image {
  margin-top: 2%;
}
.selected__item {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 65vh;
  margin-top: -3rem;
}
.selected__image {
  transform: scale(0.8);
  object-fit: contain;
}
.thumbnail__item {
  /* transform: scale(0.7); */
  object-fit: cover;
}
.selected-thumbnail {
  border: 0.5rem solid var(--dark-green);
}
@media (max-width: 1200px) {
  .selected__image {
    max-height: 70vh; 
    object-fit: contain; 
    transform: scale(0.95); 
  }
  .thumbnail__item {
    transform: scale(0.75);
    object-fit: cover;
  }
  .selected-thumbnail {
    border: 0.3rem solid var(--dark-green);
  }
}
@media (max-width: 900px) {
  .selected__image {
    transform: scale(0.7);
    margin: -8rem 5rem 0 0;
  }
}
</style>
