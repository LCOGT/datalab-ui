<script>
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'
import ThumbnailImage from '@/components/Global/ThumbnailImage.vue'
import {Drag,DropList} from 'vue-easy-dnd'
import { ref } from 'vue'

export default {
  name: 'MultiImageInputSelector',
  components: {
    Drag, DropList, ThumbnailImage
  },
  props: {
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
  },
  emits: ['insertSelectedImage', 'removeSelectedImage'],
  data: function () {
    return {
      thumbnailsStore: useThumbnailsStore(),
      configurationStore: useConfigurationStore(),
      imageDetails: {},
      filterToColor: {
        'r': 'red',
        'rp': 'red',
        'ip': 'red',
        'h-alpha': 'purple',
        'v': 'green',
        'gp': 'green',
        'oiii': 'green',
        'b': 'blue',
        'sii': 'blue'
      }
    }
  },
  computed: {
    columnSize: function() {
      const inputCount = Object.keys(this.inputDescriptions).length
      return Math.floor(12 / inputCount)
    }
  },
  mounted() {
    this.imageDetails = this.reloadImages(this.images)
  },
  methods: {
    insert(inputKey, event) {
      if (inputKey !== 'all' && ! this.selectedImages[inputKey].includes(event.data)) {
        this.$emit('insertSelectedImage', inputKey, event.data)
      }
    },
    remove(inputKey, value) {
      if (inputKey !== 'all') {
        this.$emit('removeSelectedImage', inputKey, value)
      }
    },
    reloadImages(newImages) {
      let newImageDetails = {}
      newImages.forEach(image => {
        if (image.basename && !(image.basename in newImageDetails)) {
          newImageDetails[image.basename] = ref('')
          const url = image.smallThumbUrl || image.small_url ||''
          this.thumbnailsStore.cacheImage('small', this.configurationStore.archiveType, url, image.basename).then((cachedUrl) => {
            newImageDetails[image.basename].value = cachedUrl
          })
        }
      })
      return newImageDetails
    },
    colorFromInput(inputKey) {
      if (this.inputDescriptions[inputKey].filter) {
        return this.filterToColor[this.inputDescriptions[inputKey].filter[0]]
      }
      return 'white'
    }
  },
}
</script>

<template>
  <v-row>
    <v-col
      v-for="inputKey in Object.keys(inputDescriptions)"
      :key="inputKey"
      :cols="columnSize"
      class="drop-section"
    >
      <v-card
        :title="'Selected ' + inputDescriptions[inputKey].name + ':'"
        variant="outlined"
        density="compact"
        elevation="0"
        :color="colorFromInput(inputKey)"
      >
        <v-card-text>
          <drop-list
            :items="selectedImages[inputKey]"
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
            <template #inserting-drag-image="{data}">
              <div :key="inputKey + '-' + data.basename + '-inserting-drag-image'">
                <h2>Inserting</h2>
              </div>
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
            :items="images"
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
