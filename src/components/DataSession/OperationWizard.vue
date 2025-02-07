<script setup>
import { ref, onMounted, computed, defineEmits, defineProps} from 'vue'
import { fetchApiCall, handleError } from '@/utils/api'
import { calculateColumnSpan } from '@/utils/common'
import ImageGrid from '../Global/ImageGrid'
import ImageScalingGroup from '../Global/Scaling/ImageScalingGroup'
import { useConfigurationStore } from '@/stores/configuration'
import { useAlertsStore } from '@/stores/alerts'

const props = defineProps({
  images: {
    type: Array,
    required: true
  }
})

const store = useConfigurationStore()
const alert = useAlertsStore()
const emit = defineEmits(['closeWizard', 'addOperation'])
const dataSessionsUrl = store.datalabApiBaseUrl

const availableOperations = ref({})
const selectedOperation = ref('')
const selectedOperationInput = ref({})
const selectedImages = ref({})
const imagesPerRow = ref(3)
const page = ref('select')

onMounted(async () => {
  const url = dataSessionsUrl + 'available_operations/'
  await fetchApiCall({ url: url, method: 'GET', successCallback: (data) => { availableOperations.value = data }, failCallback: handleError })
  if (Object.keys(availableOperations.value).length > 0) {
    selectOperation(Object.keys(availableOperations.value)[0])
  }
})

function updateScaling(imageName, zmin, zmax) {
  // When input image scaling is updated, we set it inside the operation input object
  // that will then be sent to the server when we add the operation
  selectedOperationInput.value[imageName][0].zmin = zmin
  selectedOperationInput.value[imageName][0].zmax = zmax
}

function selectOperation(name) {
  selectedOperation.value = name
  selectedOperationInput.value = {}
  selectedImages.value = {}
  for (const [key, value] of Object.entries(selectedOperationInputs.value)) {
    if ('default' in value) {
      selectedOperationInput.value[key] = value.default
    }
    else {
      selectedOperationInput.value[key] = null
    }
    if (value.type == 'file') {
      selectedImages.value[key] = []
    }
  }
}

function goBack() {
  if (page.value == 'select') {
    emit('closeWizard')
  }
  else {
    page.value = 'select'
  }
}

const selectedOperationDescription = computed(() => {
  if (availableOperations.value && selectedOperation.value) {
    return availableOperations.value[selectedOperation.value].description
  }
  return ''
})

const selectedOperationInputs = computed(() => {
  if (availableOperations.value && selectedOperation.value) {
    return availableOperations.value[selectedOperation.value].inputs
  }
  return {}
})

const goForwardText = computed(() => {
  if (page.value == 'select') {
    return 'Configure Operation'
  }
  else if (page.value == 'configure'){
    if (operationRequiresInputScaling.value) {
      return 'Set Image Scaling'
    }
    else{
      return 'Add Operation'
    }
  }
  else{
    return 'Add Operation'
  }
})

const disableGoForward = computed(() => {
  if (page.value == 'select') {
    return selectedOperation.value === ''
  }
  else{
    return !isInputComplete.value
  }
})

const wizardTitle = computed(() => {
  if (page.value == 'select') {
    return 'SELECT OPERATION'
  }
  else {
    return 'Configure ' + selectedOperation.value + ' Operation'
  }
})

const isInputComplete = computed(() => {
  for (const inputKey in selectedOperationInput.value) {
    const input = selectedOperationInput.value[inputKey]
    if ( input === undefined || input === null || input.length == 0) {
      return false
    }
  }
  return true
})

const operationRequiresInputScaling = computed(() => {
  for (const inputKey in selectedOperationInputs.value) {
    if (selectedOperationInputs.value[inputKey].include_custom_scale) {
      return true
    }
  }
  return false
})

function goForward() {
  if (page.value == 'select') {
    // if there are no images for a filter required by the operation, do not proceed
    for (const inputKey in selectedOperationInputs.value) {
      const inputField = selectedOperationInputs.value[inputKey]
      if (inputField.type == 'file' && props.images.length == 0){
        return
      }
    }
    page.value = 'configure'
  }
  else if (page.value == 'configure'){
    if (operationRequiresInputScaling.value) {
      page.value = 'scaling'
    }
    else {
      submitOperation()
    }
  }
  else {
    submitOperation()
  }
}

function submitOperation() {
  let operationDefinition = {
    'name': selectedOperation.value,
    'input_data': {
      ...selectedOperationInput.value
    }
  }
  emit('addOperation', operationDefinition)
  emit('closeWizard')
}

function setOperationInputImages() {
  for (const inputKey in selectedImages.value) {
    let input = []
    selectedImages.value[inputKey].forEach(index => {
      input.push(props.images[index])
    })
    selectedOperationInput.value[inputKey] = input
  }
}

function selectImage(inputKey, imageIndex) {
  const inputImages = selectedImages.value[inputKey]
  const maxImages = selectedOperationInputs.value[inputKey].maximum

  if (inputImages.includes(imageIndex)) {
    inputImages.splice(inputImages.indexOf(imageIndex), 1)
    setOperationInputImages()
  }
  else if (!maxImages || inputImages.length < maxImages){
    inputImages.push(imageIndex)
    setOperationInputImages()
  }
  else{
    alert.setAlert('warning', 'Maximum number of images selected')
    console.log('Maximum number of images selected in input', inputKey)
  }
}

</script>

<template>
  <v-card class="wizard-background">
    <v-toolbar class="wizard-toolbar">
      <v-toolbar-title class="wizard-title">
        {{ wizardTitle }}
      </v-toolbar-title>
    </v-toolbar>
    <v-card-text v-show="page == 'select'">
      <v-row>
        <v-col cols="4">
          <v-list
            density="compact"
            class="wizard-list"
          >
            <v-list-subheader class="wizard-subheader">
              OPERATION
            </v-list-subheader>
            <v-list-item
              v-for="(name, i) in Object.keys(availableOperations)"
              :key="i"
              :value="name"
              :title="name"
              :active="name == selectedOperation"
              class="wizard-operations"
              @click="selectOperation(name)"
            />
          </v-list>
        </v-col>
        <v-col cols="8">
          <v-card
            :title="selectedOperation"
            class="selected-operation"
          >
            <v-card-text>
              <span class="operation-description">
                {{ selectedOperationDescription }}
              </span>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
    <v-slide-y-reverse-transition hide-on-leave>
      <v-card-text
        v-show="page == 'configure'"
        class="wizard-card"
      >
        <div
          v-for="(inputDescription, inputKey) in selectedOperationInputs"
          :key="inputKey"
          class="operation-input-wrapper"
        >
          <v-text-field
            v-if="inputDescription.type !== 'file'"
            v-model="selectedOperationInput[inputKey]"
            :label="inputDescription.name"
            :type="inputDescription.type"
            class="operation-input"
          />
          <div v-else-if="inputDescription.type == 'file'">
            <div
              v-if="inputDescription.name"
              class="input-images"
            >
              {{ inputDescription.name }}
            </div>
            <image-grid
              :images="props.images"
              :selected-images="selectedImages[inputKey]"
              :column-span="calculateColumnSpan(images.length, imagesPerRow)"
              :allow-selection="true"
              @select-image="selectImage(inputKey, $event)"
            />
          </div>
        </div>
      </v-card-text>
    </v-slide-y-reverse-transition>
    <v-slide-y-reverse-transition hide-on-leave>
      <v-card-text
        v-show="page == 'scaling'"
        class="wizard-card"
      >
        <div v-if="isInputComplete">
          <image-scaling-group
            :input-description="selectedOperationInputs"
            :inputs="selectedOperationInput"
            @update-scaling="updateScaling"
          />
        </div>
      </v-card-text>
    </v-slide-y-reverse-transition>

    <v-card-actions class="buttons-container">
      <v-spacer />
      <v-btn
        variant="text"
        class="goback-btn"
        @click="goBack"
      >
        Go Back
      </v-btn>
      <v-btn
        variant="text"
        class="gofwd-btn"
        :disabled="disableGoForward"
        @click="goForward"
      >
        {{ goForwardText }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.wizard-background {
  background-color: var(--dark-blue);
  height: 100vh;
}

.wizard-toolbar {
  background-color: var(--metal);
}

.wizard-title {
  color: var(--tan);
  font-family: 'Open Sans', sans-serif;
  font-weight: 600;
  font-size: 1.7rem;
  letter-spacing: 0.05rem;
  margin-left: 2%;
}

.wizard-list {
  background-color: var(--metal);
}

.wizard-subheader {
  color: var(--tan);
  font-weight: 500;
  letter-spacing: 0.05rem;
  font-size: 1.4rem;
}

.wizard-operations {
  color: var(--tan);
}

.selected-operation {
  color: var(--tan);
  background-color: var(--metal);
  text-transform: uppercase;
  font-family: 'Open Sans', sans-serif;
  font-size: 3rem;
}

.operation-description {
  font-size: 1rem;
}

.operation-input {
  margin-top: 2rem;
  width: 12rem;
}

.input-images {
  font-family: 'Open Sans', sans-serif;
  color: var(--tan);
  font-size: 1.5rem;
  text-transform: uppercase;
}

.selected-image {
  border: 0.3rem solid var(--dark-green);
}

.buttons-container {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
}

.goback-btn {
  color: var(--cancel);
  font-size: 1.2rem;
}

.gofwd-btn {
  color: var(--light-blue);
  font-size: 1.2rem;
}
</style>
