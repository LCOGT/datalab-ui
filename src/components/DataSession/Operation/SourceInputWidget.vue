<script setup>
import { ref } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'

const configStore = useConfigurationStore()

const source = defineModel()
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
        if (result.dec) {
          source.value.dec = result.dec
        }
        if (result.ra) {
          source.value.ra = result.ra
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
    <v-col class="pb-0">
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
    <v-col>
      <v-number-input
        v-model="source.ra"
        label="Right Ascension"
        :precision="null"
        control-variant="hidden"
      />
    </v-col>
    <v-col>
      <v-number-input
        v-model="source.dec"
        label="Declination"
        :precision="null"
        control-variant="hidden"
      />
    </v-col>
  </v-row>
</template>

<style scoped>
</style>
