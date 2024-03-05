import { fetchApiCall } from '@/utils/api'
import { createStore } from 'vuex'
import userData from './modules/userData'
import createPersistedState from 'vuex-persistedstate'

export default createStore({
	modules: {
		userData
	},
	plugins: [createPersistedState({
		paths: ['userData'],
	})],
	state() {
		return {
			isColorblindMode: false,
			selectedImages: [],
			isConfigLoaded: false,
			datalabApiBaseUrl: '',
			datalabArchiveApiUrl: '',
			observationPortalUrl: '',
			projects: [],
			largeImageCache: [],
			smallImageCache: []
		}
	},

	mutations: {
		toggleColorblindMode(state) {
			state.isColorblindMode = !state.isColorblindMode
		},

		toggleImageSelection(state, image) {
			const index = state.selectedImages.findIndex(img => img.basename === image.basename)
			if (index >= 0) {
				state.selectedImages.splice(index, 1)
			} else {
				state.selectedImages.push(image)
			}
		},

		selectedImages(state, value) { 
			state.selectedImages = value
		},

		setIsConfigLoaded(state, value) {
			state.isConfigLoaded = value
		},

		setDatalabApiBaseUrl(state, url) {
			state.datalabApiBaseUrl = url
		},

		setDatalabArchiveUrl(state, url) {
			state.datalabArchiveApiUrl = url
		},
    
		setObservationPortalUrl(state, url) {
			state.observationPortalUrl = url
		},

		setProjects(state, projects) {
			for (const project of projects) {
				state.projects.push(project)
			}
		},

		setSmallImageCache(state, imageData) {
			state.smallImageCache = imageData
		},

		setLargeImageCache(state, imageData) {
			state.largeImageCache = imageData
		}
	},

	actions: {
		toggleColorblindMode({ commit }) {
			commit('toggleColorblindMode')
		},
		toggleImageSelection({ commit }, image) {
			commit('toggleImageSelection', image)
		},

		setSelectedImages({ commit }, images) {
			commit('selectedImages', images)
		},

		async loadAndCacheImages({ commit }, { option }) {
			const baseUrl = this.state.datalabArchiveApiUrl + 'frames/'
			const imageUrl = option ? `${baseUrl}?${option}` : baseUrl
	
			const responseData = await fetchApiCall({ url: imageUrl, method: 'GET' })
			if (responseData && responseData.results) {
				if (option === 'reduction_level=95') commit('setSmallImageCache', responseData.results)
				if (option === 'reduction_level=96') commit('setLargeImageCache', responseData.results)
			}
		}
	},
	getters: {
		isSelected: (state) => (image) => {
			return state.selectedImages.some(selectedImage => selectedImage.basename === image.basename)
		},

		selectedImages: (state) => state.selectedImages,

		// given an image basename, fetches the large res of that image
		getLargeImageFromBasename: (state) => (imageBasename) => {
			imageBasename = imageBasename.replace('-small', '')
			console.log('LOG ~ imageBasename:', imageBasename)
			const largeImage = state.largeImageCache.find(obj => obj.basename.replace('-large', '') == imageBasename)
			if(largeImage){
				return largeImage
			}
			else{
				console.warn('warn: no large image found with basename:', imageBasename)
				return null
			}
		}
	}
})
