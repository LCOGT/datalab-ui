<script setup>
import { defineProps, defineEmits } from 'vue'
import ZoomableImage from './ZoomableImage.vue'

// eslint-disable-next-line no-unused-vars
const props = defineProps(['modelValue', 'image'])
const emit = defineEmits(['update:modelValue'])

function closeDialog() { 
	emit('update:modelValue', false)
}

</script>
<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
  >
    <v-card>
      <v-toolbar
        density="comfortable"
        :elevation="8"
        :title="image.target_name"
      >
        <a
          :href="image.url"
          :download="image.basename"
          target="_blank"
        >
          <v-btn
            icon="mdi-download"
          />
        </a>
        <v-btn
          icon="mdi-close"
          @click="closeDialog()"
        />
      </v-toolbar>
      <div class="anaylzer_content">
        <zoomable-image
          :image-src="image.url"
        />
        <v-sheet
          class="pa-6"
        >
          <h1>Details</h1>
          <p>Basename: {{ image.basename }}</p>
          <p>Date & Time: {{ image.observation_date }}</p>
          <p>Site: {{ image.site_id }}</p>
          <p>Telescope: {{ image.telescope_id }}</p>
          <p>Instrument: {{ image.instrument_id }}</p>
        </v-sheet>
      </div>
    </v-card>
  </v-dialog>
</template>
<style scoped>
.anaylzer_content{
	display: flex;
}
</style>
