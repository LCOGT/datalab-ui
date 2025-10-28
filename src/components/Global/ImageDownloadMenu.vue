<script setup>
import { useAlertsStore } from '@/stores/alerts'
import { useAnalysisStore } from '@/stores/analysis'
import { useThumbnailsStore } from '@/stores/thumbnails'
import { useConfigurationStore } from '@/stores/configuration'

const props = defineProps({
  imageName: {
    type: String,
    required: true,
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
  enableScaledDownload: {
    type: Boolean,
    required: false,
    default: true,
  },
  enableTifDownload: {
    type: Boolean,
    required: false,
    default: true,
  },
  speedDialLocation: {
    type: String,
    required: false,
    default: 'left center',
  }
})

defineEmits(['analysisAction'])

const alertStore = useAlertsStore()
const analysisStore = useAnalysisStore()
const thumbnailsStore = useThumbnailsStore()
const configurationStore = useConfigurationStore()

function downloadBase64File(base64Data, filename, fileType='file'){
  downloadFile('data:image/jpeg;base64,' + base64Data, filename, fileType)
}

async function downloadJpg(jpgUrl, filename, fileType='file'){
  const urlToDownload = jpgUrl || await thumbnailsStore.cacheImage('large', configurationStore.archiveType, jpgUrl, props.imageName)
  downloadFile(urlToDownload, filename, fileType)
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
    :location="props.speedDialLocation"
    transition="fade-transition"
  >
    <template #activator="{ props: activatorProps }">
      <v-icon
        v-bind="activatorProps"
        icon="mdi-download"
        color="var(--secondary-interactive)"
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
      text=".JPG"
      @click="downloadJpg(props.jpgUrl, props.imageName, 'JPG')"
    />
    <v-btn
      v-if="props.enableTifDownload"
      key="3"
      class="file-download"
      text=".TIF"
      @click="$emit('analysisAction', 'get-tif', {'basename': props.imageName}, downloadFile)"
    />
    <template v-if="props.enableScaledDownload">
      <v-btn
        key="4"
        class="file-download"
        text="Scaled .JPG"
        @click="$emit('analysisAction', 'get-jpg', {'basename': props.imageName, 'zmin': analysisStore.zmin, 'zmax': analysisStore.zmax}, downloadBase64File)"
      />
    </template>
  </v-speed-dial>
</template>
<style scoped>
.file-download {
  color: var(--text);
  background-color: var(--primary-interactive);
}
</style>
