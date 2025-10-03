<script setup>
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import { filterToColor } from '@/utils/common'
import ThumbnailImage from '@/components/Global/ThumbnailImage.vue'
import {Drag,DropList} from 'vue-easy-dnd'
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  inputDescriptions: {
    type: Object,
    default: () => {}
  },
  selectedImages: {
    type: Object,
    default: () => {}
  },
  images: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['insertSelectedImage', 'removeSelectedImage'])

const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()
var imageDetails = ref({})

const columnSize = computed(() => {
  const inputCount = Object.keys(props.inputDescriptions).length
  return Math.floor(12 / inputCount)
})

const validInputImages = computed(() => {
  return props.images.filter(image => {
    return image.type == null || image.type == 'fits'
  })
})

onMounted(() => {
  imageDetails.value = reloadImages(props.images)
})

// Image dragged into the selected images area
function insert(inputKey, event) {
  if (inputKey !== 'all' && ! props.selectedImages[inputKey].includes(event.data)) {
    emit('insertSelectedImage', inputKey, event.data)
  }
}

// Image removed from the selected images area
function remove(inputKey, value) {
  if (inputKey !== 'all') {
    emit('removeSelectedImage', inputKey, value)
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

function colorFromInput(inputKey) {
  if (props.inputDescriptions[inputKey].filter) {
    return filterToColor(props.inputDescriptions[inputKey].filter[0])
  }
  return 'white'
}

</script>

<template>
  <v-row>
    <v-col
      v-for="inputKey in Object.keys(props.inputDescriptions)"
      :key="inputKey"
      :cols="columnSize"
      class="drop-section"
    >
      <v-card
        :title="'Selected ' + props.inputDescriptions[inputKey].name + ':'"
        variant="outlined"
        density="compact"
        elevation="0"
        :color="colorFromInput(inputKey)"
      >
        <v-card-text>
          <drop-list
            :items="props.selectedImages[inputKey]"
            mode="cut"
            :row="true"
            class="drop-section"
            @insert="insert(inputKey, $event)"
          >
            <template #item="{item}">
              <drag
                :key="inputKey + '-' + item.basename"
                :data="item"
                class="m-1 fill-width"
                @cut="remove(inputKey, item)"
              >
                <thumbnail-image
                  :image="item"
                  :image-url="imageDetails[item.basename]"
                  :enable-image-cards="false"
                  :enable-removal="true"
                  @remove-image="remove(inputKey, $event)"
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
                @remove-image="remove(inputKey, $event)"
              />
            </template>
          </drop-list>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <v-row>
    <v-col v-if="imageDetails">
      <v-card
        title="Select Images from:"
        variant="outlined"
        density="compact"
      >
        <v-card-text>
          <drop-list
            :items="validInputImages"
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

.fill-width {
  width: 100%;
}

.empty-slot {
  flex: 0 0 0;
  align-self: stretch;
  outline: 1px solid blue;
}

.drop-section {
  border-width: 2px;
  flex-direction: row;
  border-color: white;
  width: 100%;
  min-width: 200px;
  min-height: 200px;
  display: flex;
}

</style>
