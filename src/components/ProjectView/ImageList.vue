<script setup>
import { ref, onMounted } from "vue";
import { useStore } from "vuex";

const props = defineProps(["data"]);
const store = useStore();

// v-data-table setup variables
let headers = ref([
  { title: "Image Name", align: "start", sortable: true, key: "basefile_name" },
  { title: "Time", align: "start", sortable: true, key: "time" },
  { title: "Object", align: "start", sortable: true, key: "object" },
  { title: "Image", align: "start", sortable: false, key: "image" },
]);
let items = ref(props.data);
let itemsPerPage = ref(15);

// --- Selection Logic ---
let selected = ref([])

// since item-value for v-data-table is set to basefilename we need to convert it back into an object
// figuring out how to set item-value to the entire object would be great and then this function can be simplified
function select(selectedImageNames) {
  const selectedObjects = selectedImageNames.map(basefileName =>
    items.value.find(item => item.basefile_name === basefileName)
  );
  store.dispatch('setSelectedImages', selectedObjects)
}

onMounted ( () => {
  selected.value = store.getters.selectedImages.map(item => item.basefile_name)
})
</script>

<template>
  <v-data-table
    :headers="headers"
    :items="items"
    :hover="true"
    v-model:items-per-page="itemsPerPage"
    show-select
    v-model="selected"
    item-value="basefile_name"
    density="compact"
    @update:modelValue="select($event)"
  >
    <!-- TODO change src to fetch image from url-->
    <template #[`item.image`]="{ item }">
      <v-img
        :src="require('@/assets/' + item.image)"
        :alt="item.basefile_name"
        height="72"
        width="128"
        cover
      >
      </v-img>
    </template>
  </v-data-table>
</template>
