<script setup>
import CompositeImage from './CompositeImage.vue'
import ImageScaler from './ImageScaler.vue'

// This component defines a page in the OperationWizard that takes in operation wizard
// of input images that you want scaling parameters for.

const props = defineProps({
  colorChannels: {
    type: Object,
    required: true
  }
})

const compositeImageMaxWidth = window.innerWidth * 0.4

const emit = defineEmits(['updateScaling'])

</script>
<template>
  <div class="scaling-page d-flex ga-2">
    <composite-image
      :width="compositeImageMaxWidth"
      :height="compositeImageMaxWidth"
    />
    <div class="scale-controls d-flex flex-column align-center ga-4">
      <image-scaler
        v-for="(channel, index) in props.colorChannels"
        :key="index"
        :channel-index="index"
        :image="channel.image[0]"
        :color="channel.color"
        @update-scaling="(channelIndex, zmin, zmax) => emit('updateScaling', channelIndex, zmin, zmax)"
      />
    </div>
  </div>
</template>
<style scoped>
.scaling-page{
  height: 80vh;
}
.scale-controls {
  overflow-y: scroll;
  max-height: 100%;
}
</style>
