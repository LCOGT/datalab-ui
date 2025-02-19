<script setup>
import { ref } from 'vue'

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
  <v-sheet class="fits-header-sheet pa-12">
    <div class="d-flex justify-space-between align-center">
      <h1 class="mb-4 mt-4">
        FITS Headers
      </h1>
      <v-text-field
        v-model="search"
        class="ml-6"
        density="compact"
        prepend-inner-icon="mdi-magnify"
        label="Search"
        flat
        hide-details
        single-line
      />
    </div>
    <v-data-table
      v-model:search="search"
      :headers="tableHeaders"
      :items="headerDataKeyValueList"
      :items-per-page="headerDataKeyValueList.length"
      hide-default-footer
      hide-no-data
    />
  </v-sheet>
</template>
<style scoped>
.fits-header-sheet{
  background-color: var(--dark-blue);
  color: var(--tan);
}
.v-data-table{
  background-color: var(--dark-blue);
}
</style>
