<script setup>
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'

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
const analysisStore = useAnalysisStore()

function downloadBase64File(base64Data, filename, fileType='file'){
  downloadFile('data:image/jpeg;base64,' + base64Data, filename, fileType)
}

function downloadFile(file, filename, fileType='file'){
  try{
    const a = document.createElement('a')
    a.href = file
    a.download = filename
    a.click()
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
      @click="downloadFile(props.fitsUrl, props.imageName, 'FITs')"
    />
    <v-btn
      key="2"
      class="file-download"
      text=".TIF"
      @click="$emit('analysisAction', 'get-tif', {'basename': props.imageName}, downloadFile)"
    />
    <v-btn
      v-if="props.jpgUrl"
      key="3"
      class="file-download"
      text="Small .JPG"
      @click="downloadFile(props.jpgUrl, props.imageName, 'Small JPG')"
    />
    <v-btn
      key="4"
      class="file-download"
      text="Scaled .JPG"
      @click="$emit('analysisAction', 'get-jpg', {'basename': props.imageName, 'zmin': analysisStore.scaledZmin, 'zmax': analysisStore.scaledZmax}, downloadBase64File)"
    />
  </v-speed-dial>
</template>
<style scoped>
.file-download {
  color: var(--text);
  background-color: var(--primary-interactive);
}
</style>
