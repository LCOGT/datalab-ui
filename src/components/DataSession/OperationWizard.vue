<script setup>
import { ref, onMounted, computed} from 'vue'
import { fetchApiCall, handleError } from '@/utils/api'
import MultiImageInputSelector from '@/components/DataSession/MultiImageInputSelector.vue'
import ImageScalingGroup from '@/components/Global/Scaling/ImageScalingGroup'
import { useConfigurationStore } from '@/stores/configuration'

const props = defineProps({
  images: {
    type: Array,
    required: true
  }
})

const store = useConfigurationStore()
const emit = defineEmits(['closeWizard', 'addOperation'])
const dataSessionsUrl = store.datalabApiBaseUrl

const availableOperations = ref({})
const selectedOperation = ref('')
const operationInputs = ref({})

const WIZARD_PAGES = {
  SELECT: 'select',
  CONFIGURE: 'configure',
  SCALING: 'scaling'
}
const page = ref(WIZARD_PAGES.SELECT)

const inputDescriptions = computed(() => { return selectedOperation.value.inputs })

const goForwardText = computed(() => {
  if (page.value == WIZARD_PAGES.SELECT) {
    return WIZARD_PAGES.SELECT
  }
  else if (page.value == WIZARD_PAGES.CONFIGURE){
    if (operationRequiresInputScaling.value) {
      return 'Set Image Scaling'
    }
    else{
      return 'Start Operation'
    }
  }
  else{
    return 'Start Operation'
  }
})

const wizardTitle = computed(() => {
  if (page.value == WIZARD_PAGES.SELECT) {
    return 'SELECT OPERATION'
  }
  else if (page.value == WIZARD_PAGES.SCALING) {
    return 'Configure ' + selectedOperation.value.name + ' Operation: Select scale points for each channel'
  }
  else if (page.value == WIZARD_PAGES.CONFIGURE && operationRequiresInputScaling.value) {
    return 'Configure ' + selectedOperation.value.name + ' Operation: Select input images for channels'
  }
  else {
    return 'Configure ' + selectedOperation.value.name + ' Operation'
  }
})

const disableGoForward = computed(() => {
  if (page.value == WIZARD_PAGES.SELECT) {
    return selectedOperation.value === ''
  }
  else{
    return !isInputComplete.value
  }
})

const isInputComplete = computed(() => {
  for (const inputKey in operationInputs.value) {
    const input = operationInputs.value[inputKey]
    const minimum = inputDescriptions.value[inputKey].minimum
    const lessThanMinimumInputs = minimum ? input.length < minimum : input.length == 0
    if ( input === undefined || input === null || lessThanMinimumInputs) {
      return false
    }
  }
  return true
})

const operationRequiresInputScaling = computed(() => {
  for (const inputKey in inputDescriptions.value) {
    if (inputDescriptions.value[inputKey].include_custom_scale) {
      return true
    }
  }
  return false
})

const imageInputDescriptions = computed(() => {
  if (inputDescriptions.value) {
    return Object.fromEntries(Object.entries(inputDescriptions.value).filter(([, inputDescription]) => inputDescription.type == 'fits'))
  }
  return {}
})

onMounted(async () => {
  // Fetch available operations from the server
  const url = dataSessionsUrl + 'available_operations/'
  await fetchApiCall({ url: url, method: 'GET', successCallback: (data) => { availableOperations.value = data }, failCallback: handleError })
  if (Object.keys(availableOperations.value).length > 0) {
    // Select the first operation by default
    selectOperation(Object.keys(availableOperations.value)[0])
  }
})

function updateScaling(imageName, zmin, zmax) {
  // When input image scaling is updated, we set it inside the operation input object
  // that will then be sent to the server when we add the operation
  operationInputs.value[imageName][0].zmin = zmin
  operationInputs.value[imageName][0].zmax = zmax
}

function goForward() {
  if (page.value == WIZARD_PAGES.SELECT) {
    // if there are no images for a filter required by the operation, do not proceed
    for (const inputKey in inputDescriptions.value) {
      const inputField = inputDescriptions.value[inputKey]
      if (inputField.type == 'fits' && props.images.length == 0){
        return
      }
    }
    page.value = WIZARD_PAGES.CONFIGURE
  }
  else if (page.value == WIZARD_PAGES.CONFIGURE){
    if (operationRequiresInputScaling.value) {
      page.value = WIZARD_PAGES.SCALING
    }
    else {
      submitOperation()
    }
  }
  else {
    submitOperation()
  }
}

function goBack() {
  if (page.value == WIZARD_PAGES.SELECT) {
    emit('closeWizard')
  }
  else {
    page.value = WIZARD_PAGES.SELECT
  }
}

function submitOperation() {
  let operationDefinition = {
    'name': selectedOperation.value.name,
    'input_data': {
      ...operationInputs.value
    }
  }
  emit('addOperation', operationDefinition)
  emit('closeWizard')
}

function selectOperation(name) {
  selectedOperation.value = availableOperations.value[name]
  operationInputs.value = {}
  for (const [key, value] of Object.entries(inputDescriptions.value)) {
    if ('default' in value) {
      operationInputs.value[key] = value.default
    }
    else if (value.maximum === 1 && value.filter) {
      // If this entry wants on file and has pre-specified filter preferences, preselect the closest file for them
      const preselectedImage = props.images.find(image => value.filter.includes(image.filter?.trim().toLowerCase()))
      if (preselectedImage) {
        operationInputs.value[key] = [preselectedImage]
      }
    }
    else {
      operationInputs.value[key] = []
    }
  }
}

function insertSelectedImage(inputKey, image) {
  if (inputKey in operationInputs.value && !operationInputs.value[inputKey].includes(image)) {
    if (imageInputDescriptions.value[inputKey].maximum === 1) {
      // This case of only wanting a single image should have the behavior of replacing the image rather than adding to the list of inputs
      operationInputs.value[inputKey] = [image]
    }
    else if(operationInputs.value[inputKey].length >= imageInputDescriptions.value[inputKey].maximum) {
      operationInputs.value[inputKey].pop(image)
      operationInputs.value[inputKey].push(image)
    }
    else{
      operationInputs.value[inputKey].push(image)
    }
  }
}

function removeSelectedImage(inputKey, image) {
  operationInputs.value[inputKey].splice(operationInputs.value[inputKey].indexOf(image), 1)
}

</script>

<template>
  <v-card class="wizard-background">
    <v-toolbar class="wizard-toolbar">
      <v-toolbar-title class="wizard-title">
        {{ wizardTitle }}
      </v-toolbar-title>
    </v-toolbar>
    <v-card-text v-show="page == WIZARD_PAGES.SELECT">
      <v-row>
        <v-col cols="4">
          <v-list
            density="compact"
            class="wizard-list"
          >
            <v-list-subheader class="wizard-subheader">
              OPERATIONS
            </v-list-subheader>
            <v-list-item
              v-for="(name, i) in Object.keys(availableOperations)"
              :key="i"
              :value="name"
              :title="name"
              :active="name == selectedOperation.name"
              class="wizard-operations"
              @click="selectOperation(name)"
            />
          </v-list>
        </v-col>
        <v-col cols="8">
          <v-card
            :title="selectedOperation.name"
            class="selected-operation"
          >
            <v-card-text>
              <span class="operation-description">
                {{ selectedOperation.description }}
              </span>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
    <v-slide-y-reverse-transition hide-on-leave>
      <v-card-text
        v-show="page == WIZARD_PAGES.CONFIGURE"
        class="wizard-card"
      >
        <div class="operation-input-wrapper">
          <multi-image-input-selector
            :inputDescriptions="imageInputDescriptions"
            :selectedImages="operationInputs"
            :images="props.images"
            @insert-selected-image="insertSelectedImage"
            @remove-selected-image="removeSelectedImage"
          >
          </multi-image-input-selector>
        </div>
        <div
          v-for="(inputDescription, inputKey) in inputDescriptions"
          :key="inputKey"
          class="operation-input-wrapper"
        >
          <v-text-field
            v-if="inputDescription.type == 'text'"
            v-model="operationInputs[inputKey]"
            :label="inputDescription.name"
            :type="inputDescription.type"
            class="operation-input"
          />
        </div>
      </v-card-text>
    </v-slide-y-reverse-transition>
    <v-slide-y-reverse-transition hide-on-leave>
      <v-card-text
        v-show="page == WIZARD_PAGES.SCALING"
        class="wizard-card"
      >
        <image-scaling-group
          v-if="isInputComplete && inputDescriptions"
          :input-description="inputDescriptions"
          :inputs="operationInputs"
          @update-scaling="updateScaling"
        />
      </v-card-text>
    </v-slide-y-reverse-transition>

    <v-card-actions class="buttons-container">
      <v-spacer />
      <v-btn
        class="goback-btn"
        prepend-icon="mdi-arrow-left"
        @click="goBack"
      >
        Back
      </v-btn>
      <v-btn
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
  background-color: var(--primary-background);
  height: 100vh;
}

.wizard-toolbar {
  background-color: var(--header);
}

.wizard-title {
  color: var(--text);
  font-family: var(--font-headers);
  text-transform: uppercase;
  font-weight: 600;
  font-size: 1.7rem;
  letter-spacing: 0.05rem;
  margin-left: 2%;
}

.wizard-list {
  background-color: var(--header);
}

.wizard-subheader {
  color: var(--text);
  font-weight: 500;
  letter-spacing: 0.05rem;
  font-size: 1.4rem;
}

.wizard-operations {
  color: var(--text);
}

.selected-operation {
  color: var(--text);
  background-color: var(--card-background);
  text-transform: uppercase;
  font-family: var(--font-stack);
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
  font-family: var(--font-stack);
  color: var(--text);
  font-size: 1.5rem;
  text-transform: uppercase;
}

.selected-image {
  border: 0.3rem solid var(--secondary-interactive);
}

.buttons-container {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
}

.goback-btn {
  background-color: var(--cancel);
  font-size: 1.2rem;
}

.gofwd-btn {
  background-color: var(--primary-interactive);
  font-size: 1.2rem;
}
</style>
