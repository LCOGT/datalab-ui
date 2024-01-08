<script setup>
import { ref, onMounted } from 'vue'
import OperationPipeline from './OperationPipeline.vue';

const emit = defineEmits(['reloadSession'])
const images = ref([])

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

function addOperation(operationDefinition) {
  // Create data operation in this session with input parameters specified from wizard
  fetch('http://127.0.0.1:8000/api/datasessions/' + props.data.id + '/operations/', {
    'method': 'POST',
    'body': JSON.stringify(operationDefinition),
    'headers': {
      'Authorization': 'Token 123456789abcdefg',
      'Content-type': 'application/json; charset=UTF-8'
    }
  })
    .then(response => response.json())
    .then(function() {emit('reloadSession')})
    .catch(error => console.error('Error:', error));
}

const getImages = async () => {
  try {
    const response = await fetch ('http://127.0.0.1:8000/api/datasessions/', {
      method: 'GET',
      headers: {
        'Authorization': 'Token 123456789abcdefg',
        'Content-Type': 'application/json; charset=UTF-8'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Error Response Data:', errorData)
      throw new Error('Bad request')
    }

    const data = await response.json()
    console.log(data)
    images.value = data.results
    .flatMap(img => img.input_data)
    // Filtering out items with 'archive' in the source
    .filter(src => !src.source.includes('archive'))
    .map(src => src.source)
  } catch (error) {
    console.log('Error getting images: ', error)
  }

}

onMounted(() => {
  getImages()
})

</script>

<template>
  <v-container class="d-lg-flex">
    <v-row>
      <v-col cols="9">
        <!-- TODO: Place input/output view here -->
        <v-carousel>
          <v-carousel-item
            v-for="(image, index) in images"
            :key="index"
            :src="require('../assets/' + image)"
            cover
          ></v-carousel-item>
        </v-carousel>
      </v-col>
      <v-col cols="3" justify="center" align="center">
        <!-- The operations bar list goes here -->
        <operation-pipeline :operations="data.operations" @add-operation="addOperation">

        </operation-pipeline>
      </v-col>
    </v-row>
  </v-container>
</template>
