
<script setup>
import { ref, defineProps, watch } from 'vue'
import { useStore } from 'vuex'
import { Carousel, Slide  } from 'vue3-carousel'
import 'vue3-carousel/dist/carousel.css'
import ImageAnalyzer from '../Global/ImageAnalyzer.vue'

const props = defineProps({
	data: {
		type: Array,
		required: true
	}
})

const store = useStore()
const currentSlide = ref(0)
const currSmallImage = ref(null)
const currLargeImage = ref(null)
const showAnalysisDialog = ref(false)

const handleThumbnailClick = (item, index) => {
	store.dispatch('toggleImageSelection', item)
	const lastSelectedImage = store.state.selectedImages.length > 0 ? store.state.selectedImages[store.state.selectedImages.length - 1] : null
	const isLastSelectedImageInCurrentProject = lastSelectedImage && props.data.some(img => img.basename === lastSelectedImage.basename)
	if (isLastSelectedImageInCurrentProject) {
		currSmallImage.value = lastSelectedImage
		currentSlide.value = props.data.findIndex(img => img.basename === currSmallImage.value.basename)
	} else {
		currentSlide.value = index
	}
	currLargeImage.value = store.getters.getLargeImageFromBasename(currSmallImage.value.basename)
}

watch(() => props.data, (newVal) => {
	if (newVal && newVal.length > 0) {
		currSmallImage.value = newVal[0]
		currLargeImage.value = store.getters.getLargeImageFromBasename(currSmallImage.value.basename)
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
          :src="currLargeImage?.url"
          class="selected__image"
          :alt="item.OBJECT"
          @click="showAnalysisDialog = true"
        >
      </div>
    </Slide>
  </Carousel>
  <div
    id="thumbnails"
    class="thumbnail__carousel__container"
  >
    <div
      v-for="(item, index) in data"
      :key="index"
      class="thumbnail__container"
      @click="handleThumbnailClick(item, index)"
    >
      <!-- Use lazy-src for lazy loading -->
      <v-img
        :src="item.url"
        loading="lazy"
        cover
        class="thumbnail__item"
        :class="{'selected-thumbnail': store.getters.isSelected(item)}"
        :alt="item.OBJECT"
      />
    </div>
  </div>
  <image-analyzer
    v-model="showAnalysisDialog"
    :image="currLargeImage"
  />
</template>

<style scoped>
#gallery {
  height: auto;
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
.thumbnail__carousel__container {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: center;
  padding: 0.3rem 0;
}
.thumbnail__container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: calc(20% - 20px)
}
.thumbnail__item {
  transform: scale(0.7);
  object-fit: cover;
}
.selected-thumbnail {
  border: 0.5rem solid var(--dark-green);
}
.thumbnail__carousel__container::-webkit-scrollbar {
  display: none;
}
.thumbnail__carousel__container {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
@media (max-width: 1200px) {
  .selected__image {
    max-height: 70vh; 
    object-fit: contain; 
    transform: scale(0.95); 
  }
  .thumbnail__carousel__container {
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
    padding: 0;
  }
  .thumbnail__container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: calc(25% - 20px)
  }

  .thumbnail__item {
    transform: scale(0.75);
    object-fit: cover;
  }

  .selected-thumbnail {
    border: 0.3rem solid var(--dark-green);
  }
  .thumbnail__carousel__container::-webkit-scrollbar {
    display: none;
  }
  .thumbnail__carousel__container {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .thumbnail__carousel__container {
    overflow-x: auto;
  }
}
@media (max-width: 900px) {
  .selected__image {
    transform: scale(0.7);
    margin: -8rem 5rem 0 0;
  }
  .thumbnail__container {
    margin: 0;
  }
}
</style>
