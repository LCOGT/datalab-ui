<script setup>
import { ref } from 'vue'
import { siteIDToName } from '@/utils/common'

const search = ref('')

const props = defineProps({
  headerData: {
    type: Object,
    required: true
  }
})

const headerDataKeyValueList = Object.entries(props.headerData)

const tableHeaders = ref([
  { title: 'Key', key:'0' },
  { title: 'Value', sortable: false, key:'1' },
])

</script>
<template>
  <v-sheet class="fits-header-sheet pa-10">
    <h1 class="mb-2">
      Header Information
    </h1>
    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-chip
        v-for="(chip, idx) in [
          { icon: 'mdi-earth', text: siteIDToName(headerData.SITEID) },
          { icon: 'mdi-telescope', text: headerData.TELID },
          { icon: 'mdi-camera', text: headerData.INSTRUME },
          { icon: 'mdi-clock', text: new Date(headerData.DATE).toLocaleString() }
        ]"
        :key="idx"
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
.fits-header-sheet{
  background-color: var(--primary-background);
  color: var(--text);
}
.v-data-table{
  background-color: var(--primary-background);
}
</style>
