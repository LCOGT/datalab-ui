<script setup>
import { ref, onMounted, computed } from 'vue'

const emit = defineEmits(['closeWizard', 'addOperation'])

const availableOperations = ref({});
const selectedOperation = ref('');
const selectedOperationInput = ref({});

onMounted(() => {
  // Load in the session details from the API
  // Long term, the available operations should be loaded into the store once on page load and retrieved from there
  fetch('http://127.0.0.1:8000/api/available_operations/', {
    'headers': {'Authorization': 'Token 123456789abcdefg'}
  })
    .then(response => response.json())
    .then(data => {
      availableOperations.value = data;
      if (Object.keys(availableOperations.value).length > 0){
        selectedOperation.value = Object.keys(availableOperations.value)[0];
      }
    });
})

const page = ref('select');

function selectOperation(name) {
  selectedOperation.value = name;
  selectedOperationInput.value = {};
  for (const [key, value] of Object.entries(selectedOperationInputs.value)) {
    if ('default' in value){
      selectedOperationInput.value[key] = value.default;
    }
    else {
      selectedOperationInput.value[key] = null;
    }
  }
}

function goBack() {
  if (page.value == 'select') {
    emit('closeWizard');
  }
  else {
    page.value = 'select';
  }
}

const selectedOperationDescription = computed(() => {
  if (availableOperations.value && selectedOperation.value) {
    return availableOperations.value[selectedOperation.value].description;
  }
  return '';
})

const selectedOperationInputs = computed(() => {
  if (availableOperations.value && selectedOperation.value) {
    return availableOperations.value[selectedOperation.value].inputs;
  }
  return {};
})

const goForwardText = computed(() => {
  if (page.value == 'select') {
    return 'Configure Operation';
  }
  else {
    return 'Add Operation';
  }
})

const wizardTitle = computed(() => {
  if (page.value == 'select') {
    return 'Select Operation';
  }
  else {
    return 'Configure ' + selectedOperation.value + ' Operation';
  }
})

function goForward() {
  if (page.value == 'select') {
    page.value = 'configure';
  }
  else {
    let operationDefinition = {
      'name': selectedOperation.value,
      'input_data': selectedOperationInput.value
    }
    emit('addOperation', operationDefinition);
  }
}

</script>
<template>
  <v-card>
    <v-toolbar dark color="primary">
      <v-toolbar-title>{{ wizardTitle }}</v-toolbar-title>
    </v-toolbar>
    <v-card-text v-show="page == 'select'">
      <v-row>
        <v-col cols="4">
          <v-list density="compact">
            <v-list-subheader>Operation</v-list-subheader>
            <v-list-item v-for="(name, i) in Object.keys(availableOperations)" :key="i" :value="name" color="primary" :title="name" @click="selectOperation(name)" :active="name == selectedOperation">
            </v-list-item>
          </v-list>
        </v-col>
        <v-col cols="8">
          <v-card :title="selectedOperation">
            <v-card-text>
              <span style="white-space: pre;">
                {{ selectedOperationDescription }}
              </span>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
    <v-slide-y-reverse-transition hide-on-leave>
      <v-card-text v-show="page == 'configure'">
        <v-row v-for="(inputDescription, inputKey) in selectedOperationInputs" :key="inputKey">
          <p class="mt-4 mb-4" v-if="inputDescription.type == 'file'">{{ inputKey }}: Insert a filepicker widget for {{ inputDescription.name }}</p>
          <v-text-field
            v-model="selectedOperationInput[inputKey]"
            v-if="inputDescription.type != 'file'"
            :label="inputDescription.name"
            :type="inputDescription.type"
          >
          </v-text-field>
        </v-row>
      </v-card-text>
    </v-slide-y-reverse-transition>
    <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="blue-darken-1"
          variant="text"
          @click="goBack"
        >
          Go Back
        </v-btn>
        <v-btn
          color="green-darken-1"
          variant="text"
          @click="goForward"
        >
          {{ goForwardText }}
        </v-btn>
      </v-card-actions>
  </v-card>
</template>
