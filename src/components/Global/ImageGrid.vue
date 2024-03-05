<script setup>
import { defineProps, ref, onMounted } from 'vue'
import { useStore } from 'vuex'
import { fetchApiCall, handleError } from '../../utils/api'
// eslint-disable-next-line no-unused-vars
import ImageAnalyzer from './ImageAnalyzer.vue'

const props = defineProps({
	data: {
		type: Object,
		required: true
	},
	columnSpan: {
		type: Number,
		required: true
	},
	// eslint-disable-next-line vue/require-default-prop
	selectedImages: Array
})

let images = ref([])
const store = useStore()
const showAnalysisDialog = ref(false)
const analysisImage = ref(null)

const saveImages = (data) => {
	const results = data.results
	if (results.length) {
		images.value.push(data.results[0])
	}
}

const getImages = async () => {
	const responseData = props.data
	const inputData = responseData.input_data
	for (const data of inputData) {
		const basename = data.basename
		const url =  store.state.datalabArchiveApiUrl + 'frames/?basename_exact=' + basename + '-small'
		await fetchApiCall({url: url, method: 'GET', successCallback: saveImages, failCallback: handleError})
	}
}

const isSelected = (image) => {
	return props.selectedImages?.some(selectedImage => selectedImage.basename === image.basename)
}

const onImageClick = (image) => {
	const url = store.state.datalabArchiveApiUrl + 'frames/?' + image.basename + '-large'

	function success(data){
		console.log('LOG ~ file: ImageGrid.vue:51 ~ success ~ data:', data)
		showAnalysisDialog.value = true
		analysisImage.value = data
	}

	fetchApiCall({ url: url, method: 'GET', successCallback: success, failCallback: handleError })
}

onMounted(() => {
	getImages()
})

</script>

<template>
  <v-row v-if="images.length">
    <v-col
      v-for="image of images"
      :key="image.basename"
      :cols="columnSpan"
    >
      <v-img
        :src="image.url"
        :alt="image.basename"
        :images="images"
        cover
        :class="{ 'selected-image': isSelected(image) }"
        aspect-ratio="1"
        @click="onImageClick(image)"
      />
    </v-col>
    <image-analyzer
      v-model="showAnalysisDialog"
      :image="analysisImage"
    />
  </v-row>
</template>

<style scoped>
.selected-image {
  border: 0.3rem solid var(--dark-green);
}
</style>
