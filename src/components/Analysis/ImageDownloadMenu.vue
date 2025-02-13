<script setup>
import { useAlertsStore } from '@/stores/alerts'

const props = defineProps({
  imageName: {
    type: String,
    required: true,
    default: null,
  },
  fitsUrl: {
    type: String,
    required: false,
    default: null,
  },
  jpgUrl: {
    type: String,
    required: false,
    default: null,
  },
})

defineEmits(['analysisAction'])

const alertStore = useAlertsStore()

function downloadLink(link, filename, fileType='file'){
  try{
    const a = document.createElement('a')
    a.href = link
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (error) {
    alertStore.setAlert('error', `Failed to download ${fileType} file`)
  }
}

</script>
<template>
  <v-speed-dial
    variant="text"
    location="left center"
    transition="fade-transition"
  >
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        icon="mdi-download"
      />
    </template>
    <v-btn
      v-if="props.fitsUrl"
      key="1"
      class="file-download"
      text=".FITS"
      @click="downloadLink(props.fitsUrl, props.imageName, 'FITs')"
    />
    <v-btn
      key="2"
      class="file-download"
      text=".TIF"
      @click="$emit('analysisAction', 'get-tif', {'basename': props.imageName}, downloadLink)"
    />
    <v-btn
      v-if="props.jpgUrl"
      key="3"
      class="file-download"
      text=".JPG"
      @click="downloadLink(props.jpgUrl, props.imageName, 'JPG')"
    />
  </v-speed-dial>
</template>
<style scoped>
.file-download {
  background-color: var(--light-blue);
}
</style>
