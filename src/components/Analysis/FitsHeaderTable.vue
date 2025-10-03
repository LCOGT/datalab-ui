<script setup>
import { ref, computed } from 'vue'
import { siteIDToName } from '@/utils/common'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()

const search = ref('') // v-data-table search model
const headerDataKeyValueList = Object.entries(analysisStore.headerData)

const tableHeaders = [
  { title: 'Key', key:'0' },
  { title: 'Value', sortable: false, key:'1' },
]

// Loopable chip dict for v-chips
const headerChips = computed(() => [
  { icon: 'mdi-earth', text: siteIDToName(analysisStore.headerData.SITEID) },
  { icon: 'mdi-telescope', text: analysisStore.headerData.TELID },
  { icon: 'mdi-camera', text: analysisStore.headerData.INSTRUME },
  { icon: 'mdi-clock', text: new Date(analysisStore.headerData.DATE).toLocaleString() }
])

</script>
<template>
  <v-sheet class="fits-header-sheet pa-10">
    <h1 class="mb-2">
      Header Information
    </h1>
    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-chip
        v-for="(chip) in headerChips"
        :key="chip.icon"
        :prepend-icon="chip.icon"
        color="var(--info)"
        :text="chip.text"
      />
    </div>
    <v-text-field
      v-model="search"
      variant="solo-filled"
      bg-color="var(--primary-background)"
      prepend-inner-icon="mdi-magnify"
      label="Search FITS Headers"
      single-line
    />
    <v-data-table
      v-model:search="search"
      :headers="tableHeaders"
      :items="headerDataKeyValueList"
      :items-per-page="headerDataKeyValueList.length"
      hide-default-header
      hide-default-footer
      hide-no-data
    />
  </v-sheet>
</template>
<style scoped>
.fits-header-sheet,
.v-data-table {
  background-color: var(--primary-background);
}
.fits-header-sheet{
  color: var(--text);
}
</style>
