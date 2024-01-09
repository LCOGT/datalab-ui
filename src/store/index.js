import { createStore } from 'vuex'

export default createStore({
  state() {
    return {
      // Array of selected images. Image objects that get selected get pushed here
      selectedImages: []
    }
  },
  mutations: {
    // This mutation changes the state of selectedImages
    // It should be dispatched when an image is selected/unselected
    toggleImageSelection(state, image) {
      // By using the findIndex method, we check if there's an basefile_name from MockData that's the same 
      // as the clicked image's basefilename
      const index = state.selectedImages.findIndex(img => img.basefile_name === image.basefile_name)
      // If it's in the selectedImages array, it will return a number greater than or equal to 0
      // so we splice it from the selectedImages array
      if (index >= 0) {
        state.selectedImages.splice(index, 1)
        // Otherwise, it will return a -1 and we push the object to the array
      } else {
        state.selectedImages.push(image)
      }
    },
    selectedImages(state, val) { state.selectedImages = val }
  },
  actions: {
    // select a single image
    toggleImageSelection({ commit }, image) {
      commit('toggleImageSelection', image)
    },
    // pass a new array of selected images
    setSelectedImages({ commit }, images) {
      commit('selectedImages', images)
    }
  },
  getters: {
    // By using the some method, we check if any of the images pass the condition in which they have the same basefile_name
    // as the selected image's basefile_name
    // this should be used to add or remove a check when images are being viewed as archive (maybe? maybe not?? open to suggestions and moving this to ImageCarousel component)
    isSelected: (state) => (image) => {
      return state.selectedImages.some(selectedImage => selectedImage.basefile_name === image.basefile_name)
    },
    selectedImages: (state) => state.selectedImages
  }
})
