<script setup>
import { ref, computed } from 'vue'
import { basenameToSequence, siteIDToName } from '@/utils/common'

const props = defineProps({
  headerData: {
    type: Object,
    required: true,
  },
  image: {
    type: Object,
    required: true,
  },
})

const search = ref('') // v-data-table search model
const headerDataKeyValueList = computed(() => Object.entries(props.headerData))

const tableHeaders = [
  { title: 'Key', key:'0' },
  { title: 'Value', sortable: false, key:'1' },
]

const basenameSequence = computed(() => basenameToSequence(props.image.basename))

// Loopable chip dict for v-chips
const headerChips = computed(() => [
  { icon: 'mdi-earth', text: siteIDToName(props.headerData.SITEID) },
  { icon: 'mdi-telescope', text: props.headerData.TELID },
  { icon: 'mdi-camera', text: props.headerData.INSTRUME },
  { icon: 'mdi-clock', text: new Date(props.headerData.DATE).toLocaleString() },
  { icon: 'mdi-numeric', text: basenameSequence.value }
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
