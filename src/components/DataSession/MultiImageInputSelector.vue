<script setup>
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import ThumbnailImage from '@/components/Global/ThumbnailImage.vue'
import {Drag,DropList} from 'vue-easy-dnd'
import { ref, onMounted, computed } from 'vue'

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

const emit = defineEmits(['insertImage', 'removeImage', 'addChannel', 'removeChannel', 'updateChannelColor'])

const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()
var imageDetails = ref({})

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

onMounted(() => {
  imageDetails.value = reloadImages(props.images)
})

function insert(inputKey, index, event) {
  if (inputKey !== 'all' && ! props.inputImages[inputKey].includes(event.data)) {
    emit('insertImage', inputKey, event.data, index)
  }
}

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

</script>

<template>
  <v-row>
    <div class="d-flex ma-3 ga-2 w-100">
      <v-card
        v-for="(inputKey, index) in inputList"
        :key="inputKey+index"
        :title="props.inputDescriptions[inputKey].name"
        color="var(--card-background)"
        density="compact"
      >
        <v-card-text>
          <drop-list
            :items="colorChannelMode? props.inputImages[inputKey][index].image : props.inputImages[inputKey]"
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
}

</style>
