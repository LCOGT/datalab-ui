<script setup>
import { ref, watch, defineEmits, defineProps, computed } from 'vue'
import CompositeImage from './CompositeImage.vue'
import ImageScaler from './ImageScaler.vue'

// This component defines a page in the OperationWizard that takes in operation wizard
// input descriptions and selected input and creates a tab view for all the groupings
// of input images that you want scaling parameters for.

const props = defineProps({
  inputDescription: {
    type: Object,
    required: true
  },
  inputs: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['updateScaling'])
const tab = ref('rgb')


const scaleGroupings = computed(() => {
  var scaleGroups = {}
  for (const inputKey in props.inputDescription) {
    if (props.inputDescription[inputKey].include_custom_scale) {
      var scaleGroup = props.inputDescription[inputKey].combine_custom_scale || 'default'
      if (!(scaleGroup in scaleGroups)) {
        scaleGroups[scaleGroup] = {}
      }
      scaleGroups[scaleGroup][inputKey] = props.inputs[inputKey][0]
    }
  }
  return scaleGroups
})

watch(
  () => props.inputDescription, () => {
    tab.value = Object.keys(scaleGroupings.value)[0]
  },
  { immediate: true }
)

</script>
<template>
  <v-card>
    <v-tabs
      v-model="tab"
      class="tabs"
      next-icon="mdi-arrow-right-bold-box-outline"
      prev-icon="mdi-arrow-left-bold-box-outline"
      show-arrows
    >
      <v-tab
        v-for="(groupInputs, groupName) in scaleGroupings"
        :key="groupName"
        :value="groupName"
        class="pr-0 tab"
      >
      {{ groupName }}
      </v-tab>
    </v-tabs>
    <v-card-text>
      <v-tabs-window v-model="tab">
        <v-tabs-window-item
          v-for="(groupInputs, groupName) in scaleGroupings"
          :key="groupName"
          :value="groupName"
        >
          <v-content style="height:100vh">
            <v-container fluid pa-0 class="d-flex flex-column flex-grow-1 fill-parent-height">
              <v-row no-gutters>
                <v-col cols="6" class="flex-grow-1 flex-shrink-1 fill-parent-height scaled-images">
                  <v-row no-gutters
                    v-for="(groupInput, groupInputName ) in groupInputs"
                    :key="groupName + '-' + groupInputName"
                  >
                    <image-scaler
                      v-if="groupInput"
                      :image="groupInput"
                      :image-name="groupInputName"
                      :composite-name="groupName"
                      @update-scaling="(imageName, zmin, zmax) => emit('updateScaling', imageName, zmin, zmax)"
                    >
                    </image-scaler>
                    <v-divider></v-divider>
                  </v-row>
                </v-col>
                <v-col cols="6" class="flex-grow-0 flex-shrink-0 fill-parent-height mt-8" v-if="groupName != 'default'">
                  <v-row no-gutters>
                    <composite-image
                      :width=500
                      :height=500
                      :imageName="groupName"
                    >
                    </composite-image>
                  </v-row>
                </v-col>
              </v-row>
            </v-container>
          </v-content>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>

  </v-card>
</template>
<style scoped>
.tab {
  font-size: 1.2rem;
  text-decoration: none;
  color: var(--tan);
  font-weight: 600;
  background-color: var(--metal);
}

.tabs {
  background-color: var(--metal);
  border-bottom: 0.1rem solid var(--tan);
}

.fill-parent-height {
  height: 100%;
}

.scaled-images {
  overflow-y: auto;
  max-height:550px;
}
</style>
