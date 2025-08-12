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
  mounted() {
    this.imageDetails = this.reloadImages(this.images)
  },
}
</script>

<template>
  <v-row>
    <v-col
      v-for="inputKey in Object.keys(this.inputDescriptions)"
      :key="inputKey"
      :cols="columnSize"
      class="drop-section"
    >
    <v-card :title="'Selected ' + this.inputDescriptions[inputKey].name + ':'" variant="outlined" density="compact" elevation="0" :color="colorFromInput(inputKey)">
      <v-card-text>
        <drop-list :items="this.selectedImages[inputKey]" @insert="insert(inputKey, $event)" mode="cut" :row="true" class="drop-section">
          <template v-slot:item="{item}">
            <drag :key="inputKey + '-' + item.basename" :data="item" @cut="remove(inputKey, item)" class="m-1 fill-width">
              <thumbnail-image
                :image="item"
                :image-url="this.imageDetails[item.basename]"
                :enable-image-cards="false"
                :enable-removal="true"
                @remove-image="remove(inputKey, $event)"
              ></thumbnail-image>
            </drag>
          </template>
          <template v-slot:inserting-drag-image="{data}">
            <div :key="inputKey + '-' + data.basename + '-inserting-drag-image'">
              <h2>Inserting</h2>
            </div>
        </template>
          <template v-slot:feedback="{data}">
            <thumbnail-image
                :image="data"
                :image-url="this.imageDetails[data.basename]"
                :enable-image-cards="false"
                :enable-removal="true"
                @remove-image="remove(inputKey, $event)"
                :key="inputKey + '-' + data.basename + '-feedback'"
              ></thumbnail-image>
          </template>
        </drop-list>
      </v-card-text>
    </v-card>
    </v-col>
  </v-row>
  <v-row>
    <v-col v-if="this.imageDetails">
      <v-card title="Select Images from:" variant="outlined" density="compact">
        <v-card-text>
          <drop-list :items="this.images" @insert="insert('all', $event)" mode="cut" :row="true" :no-animations="true">
            <template v-slot:item="{item}">
              <drag :key="'all-' + item.basename" :data="item" @cut="remove('all', item)" class="m-2 list-image">
                <thumbnail-image
                  :image="item"
                  :image-url="this.imageDetails[item.basename]"
                  :enable-image-cards="false"
                ></thumbnail-image>
              </drag>
            </template>
            <template v-slot:feedback="{data}">
              <div class="list-image" :key="'all-' + data.basename + '-feedback'"></div>
            </template>
            <template v-slot:reordering-feedback="{item}">
              <div class="list-image" :key="'all-' + item.basename + '-reordering-feedback'"></div>
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
