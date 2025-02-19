<script setup>
import { defineEmits, defineProps, computed } from 'vue'
import CompositeImage from './CompositeImage.vue'
import ImageScaler from './ImageScaler.vue'

// This component defines a page in the OperationWizard that takes in operation wizard
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

const compositeImageMaxWidth = window.innerWidth * 0.4

const emit = defineEmits(['updateScaling'])

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

</script>
<template>
  <div
    v-for="(groupInputs, groupName) in scaleGroupings"
    :key="groupName"
    class="image-scaling-group"
    :value="groupName"
  >
    <div class="composite-image-container">
      <composite-image
        :width="compositeImageMaxWidth"
        :height="compositeImageMaxWidth"
        :image-name="groupName"
      />
    </div>
    <div class="scale-controls">
      <image-scaler
        v-for="(groupInput, groupInputName ) in groupInputs"
        :key="groupName + '-' + groupInputName"
        :image="groupInput"
        :image-name="groupInputName"
        :composite-name="groupName"
        @update-scaling="(imageName, zmin, zmax) => emit('updateScaling', imageName, zmin, zmax)"
      />
    </div>
  </div>
</template>
<style scoped>
.image-scaling-group{
  height: 80vh;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}
.composite-image-container{
  display: flex;
  justify-content: center;
  align-items: center;
}
.scale-controls {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 50%;
  min-width: 532px;
}
.image-scaler{
  width: 100%;
}
</style>
