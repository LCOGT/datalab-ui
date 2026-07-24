<script setup>
import { ref } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import {
  coordinateInputToDegrees,
  raDegreesToSexagesimal,
  decDegreesToSexagesimal,
  raSexagesimalToDegrees,
  decSexagesimalToDegrees,
} from '@/utils/coordinates'

const configStore = useConfigurationStore()

const source = defineModel({
  type: Object,
  required: true,
})
const loading = ref(false)
const targetNameError = ref('')

async function performTargetLookup() {
  if (source.value.name) {
    loading.value = true
    targetNameError.value = ''
    const url =  configStore.simbad2kUrl + source.value.name + '?target_type=SIDEREAL' 
    try {
      const response = await fetch(url)
      if (!response.ok) {
        loading.value = false
        targetNameError.value = 'Failed Target name lookup'
      }
      else {
        const result = await response.json()
        if (result.error) {
          targetNameError.value = result.error
        }
        if (result.ra !== undefined) {
          source.value.ra = raDegreesToSexagesimal(coordinateInputToDegrees(result.ra, raSexagesimalToDegrees))
        }
        if (result.dec !== undefined) {
          source.value.dec = decDegreesToSexagesimal(coordinateInputToDegrees(result.dec, decSexagesimalToDegrees))
        }
        loading.value = false
      }
    } catch (error) {
      loading.value = false
      targetNameError.value = error
    }
  }
}

</script>
<template>
  <v-row>
    <v-col
      cols="12"
      md="4"
      class="pb-0"
    >
      <v-text-field
        v-model="source.name"
        :loading="loading"
        :error-messages="targetNameError"
        label="Source name"
        type="text"
        append-inner-icon="mdi-magnify"
        @click:append-inner="performTargetLookup"
      />
    </v-col>
    <v-col
      cols="12"
      md="4"
      class="pb-0"
    >
      <v-text-field
        v-model="source.ra"
        label="Right Ascension"
        type="text"
      />
    </v-col>
    <v-col
      cols="12"
      md="4"
      class="pb-0"
    >
      <v-text-field
        v-model="source.dec"
        label="Declination"
        type="text"
      />
    </v-col>
  </v-row>
</template>

<style scoped>
</style>
