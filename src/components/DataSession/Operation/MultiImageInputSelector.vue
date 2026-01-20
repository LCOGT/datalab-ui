<script setup>
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import ThumbnailImage from '@/components/Global/ThumbnailImage.vue'
import {Drag,DropList} from 'vue-easy-dnd'
import { ref, onMounted, computed, watch } from 'vue'

const props = defineProps({
  inputDescriptions: {
    type: Object,
    default: () => {}
  },
  inputImages: {
    type: Object,
    default: () => {}
  },
  images: {
    type: Array,
    default: () => []
  },
  maxInputs: {
    type: Number,
    default: 5
  },
  minInputs: {
    type: Number,
    default: 1
  },
})

const emit = defineEmits(['insertImage', 'removeImage', 'setImages', 'addChannel', 'removeChannel', 'updateChannelColor'])

const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()
var imageDetails = ref({})
var selectedFilter = ref({})

const colorChannelMode = computed(() => { return props.inputDescriptions.color_channels != null })

const inputCount = computed(() => {
  return props.inputDescriptions.color_channels 
    ? props.inputImages.color_channels.length
    : Object.keys(props.inputDescriptions).length
})

const inputList = computed(() => {
  return props.inputDescriptions.color_channels
    ? Array.from({ length: inputCount.value }, () => 'color_channels')
    : Object.keys(props.inputDescriptions)
})

const fitsImages = computed(() => {
  return props.images.filter(image => {
    return image.type == null || image.type == 'fits'
  })
})

const filterOptionsMap = computed(() => {
  let filterMap = new Map()
  if (fitsImages.value) {
    fitsImages.value.forEach(image => {
      const filter = image.filter || image.primary_optical_element
      filterMap.set(filter, (filterMap.get(filter) || 0) + 1)
    })
  }
  return filterMap
})

onMounted(() => {
  imageDetails.value = reloadImages(props.images)
})

// When inputDescriptions is set, update initial selectedFilter if need be
watch(() => props.inputDescriptions, () => updateSelectedFilter())

function mostFrequentFilterForInputKey(inputKey) {
  let mostFrequentCount = 0
  const filterOptions = filterOptionsForInputKey(inputKey)
  let mostFrequentFilter = undefined
  for (const [filter, count] of filterOptionsMap.value.entries()) {
    if (filterOptions.includes(filter) && count > mostFrequentCount) {
      mostFrequentCount = count
      mostFrequentFilter = filter
    }
  }
  return mostFrequentFilter
}

function filterOptionsForInputKey(inputKey) {
  let filterOptions = Array.from(filterOptionsMap.value.keys())
  if (props.inputDescriptions[inputKey].filter_options) {
    return filterOptions.filter(item => props.inputDescriptions[inputKey].filter_options.includes(item))
  }
  else{
    return filterOptions
  }
}

// Image dragged into the selected images area
function insert(inputKey, index, event) {
  if (inputKey !== 'all' && !props.inputImages[inputKey].includes(event.data)) {
    // Also check if the inputKey is single_filter mode and already has another filter set
    if (!props.inputDescriptions[inputKey].single_filter || event.data.filter == selectedFilter.value[inputKey] || event.data.primary_optical_element == selectedFilter.value[inputKey]) {
      emit('insertImage', inputKey, event.data, index)
    }
  }
}

// Image removed from the selected images area
function remove(inputKey, index, value) {
  if (inputKey !== 'all') {
    emit('removeImage', inputKey, value, index)
  }
}

function reloadImages(newImages) {
  let newImageDetails = {}
  newImages.forEach(image => {
    if (image.basename && !(image.basename in newImageDetails)) {
      newImageDetails[image.basename] = ref('')
      const url = image.smallThumbUrl || image.small_url ||''
      thumbnailsStore.cacheImage('small', configurationStore.archiveType, url, image.basename).then((cachedUrl) => {
        newImageDetails[image.basename].value = cachedUrl
      })
    }
  })
  return newImageDetails
}

function updateSelectedFilter() {
  if (props.inputDescriptions) {
    for (const [inputKey, inputDescription] of Object.entries(props.inputDescriptions)) {
      if (inputDescription.single_filter) {
        selectedFilter.value[inputKey] = mostFrequentFilterForInputKey(inputKey)
        updateSelectedImagesForFilter(inputKey, selectedFilter.value[inputKey])
      }
    }
  }
}

function updateSelectedImagesForFilter(inputKey, filter) {
  let filteredImages = fitsImages.value.filter(image => {
    return image.filter == filter || image.primary_optical_element == filter
  })
  emit('setImages', inputKey, filteredImages)
}

</script>

<template>
  <v-row>
    <div class="d-flex ma-3 ga-2 w-100">
      <v-card
        v-for="(inputKey, index) in inputList"
        :key="inputKey+index"
        color="var(--card-background)"
        density="compact"
      >
        <v-card-title>
          <div v-if="!props.inputDescriptions[inputKey].single_filter">
            {{ props.inputDescriptions[inputKey].name }}
          </div>
          <div v-if="props.inputDescriptions[inputKey].single_filter">
            <v-select
              v-model="selectedFilter[inputKey]"
              :items="filterOptionsForInputKey(inputKey)"
              label="Filter"
              density="compact"
              variant="outlined"
              @update:model-value="updateSelectedImagesForFilter(inputKey, $event)"
            >
              <template #prepend>
                {{ props.inputDescriptions[inputKey].name }} Filter:
              </template>
            </v-select>
          </div>
        </v-card-title>
        <v-card-text>
          <drop-list
            :items="colorChannelMode? [props.inputImages[inputKey][index]] : props.inputImages[inputKey]"
            mode="cut"
            :row="true"
            class="drop-section"
            @insert="insert(inputKey, index, $event)"
          >
            <template #item="{item}">
              <drag
                :key="inputKey + '-' + item.basename"
                :data="item"
                class="m-1 w-100"
                @cut="remove(inputKey, index, item)"
              >
                <thumbnail-image
                  :image="item"
                  :image-url="imageDetails[item.basename]"
                  :enable-image-cards="false"
                  :enable-removal="true"
                  @remove-image="remove(inputKey, index, $event)"
                />
              </drag>
            </template>
            <template #feedback="{data}">
              <thumbnail-image
                :key="inputKey + '-' + data.basename + '-feedback'"
                :image="data"
                :image-url="imageDetails[data.basename]"
                :enable-image-cards="false"
                :enable-removal="true"
                @remove-image="remove(inputKey, index, $event)"
              />
            </template>
          </drop-list>
          <v-alert
            v-if="props.inputDescriptions[inputKey].minimum && props.inputImages[inputKey].length < props.inputDescriptions[inputKey].minimum"
            density="compact"
            :text="'Requires at least ' + props.inputDescriptions[inputKey].minimum + ' images'"
            type="warning"
          >
          </v-alert>
          <v-color-picker
            v-if="colorChannelMode"
            :model-value="props.inputImages[inputKey][index].color"
            class="w-100"
            bg-color="var(--card-background)"
            :elevation="0"
            landscape
            hide-canvas
            hide-eye-dropper
            :modes="['rgb']"
            @update:model-value="(value) => emit('updateChannelColor', index, value)"
          />
        </v-card-text>
      </v-card>
      <div
        v-if="colorChannelMode"
        class="d-flex flex-column ga-4 justify-center ms-auto"
      >
        <v-btn
          class="h-50 rounded-lg"
          icon="mdi-plus"
          :disabled="props.inputImages.color_channels.length >= props.maxInputs"
          color="var(--primary-interactive)"
          @click="emit('addChannel')"
        /> 
        <v-btn
          class="h-50 rounded-lg"
          icon="mdi-minus"
          :disabled="props.inputImages.color_channels.length <= props.minInputs"
          color="var(--primary-interactive)"
          @click="emit('removeChannel')"
        />
      </div>
    </div>
  </v-row>
  <v-row>
    <v-col v-if="imageDetails">
      <v-card
        title="Select Images from:"
        color="var(--card-background)"
        density="compact"
      >
        <v-card-text>
          <drop-list
            :items="fitsImages"
            mode="cut"
            :row="true"
            :no-animations="true"
            @insert="insert('all', $event)"
          >
            <template #item="{item}">
              <drag
                :key="'all-' + item.basename"
                :data="item"
                class="m-2 list-image"
                @cut="remove('all', item)"
              >
                <thumbnail-image
                  :image="item"
                  :image-url="imageDetails[item.basename]"
                  :enable-image-cards="false"
                />
              </drag>
            </template>
            <template #feedback="{data}">
              <div
                :key="'all-' + data.basename + '-feedback'"
                class="list-image"
              />
            </template>
            <template #reordering-feedback="{item}">
              <div
                :key="'all-' + item.basename + '-reordering-feedback'"
                class="list-image"
              />
            </template>
          </drop-list>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>

.dnd-image {
  max-width: 200px;
  min-width: 120px;
  width: 100%;
}

.list-image {
  display: inline-block;
}

.drop-section {
  flex-direction: row;
  width: 100%;
  min-width: 200px;
  min-height: 200px;
  display: flex;
  overflow-x: scroll;
}

</style>
