<script setup>
import { ref, onMounted, computed} from 'vue'
import { fetchApiCall, handleError } from '@/utils/api'
import { rgbFilterMap, colorRGBMap } from '@/utils/color'
import MultiImageInputSelector from '@/components/DataSession/MultiImageInputSelector.vue'
import WizardScalingPage from '@/components/Global/Scaling/WizardScalingPage.vue'
import { useConfigurationStore } from '@/stores/configuration'

/*
  This component is a step wizard for configuring the input of a new operation to the data session.
  It has three main pages:
    1. Select Operation
    2. Configure Operation
    3. Set Image Scaling (if required)
*/

const props = defineProps({
  // Available images to select from
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
const MAX_COLOR_CHANNELS = 6
const MIN_COLOR_CHANNELS = 1

const WIZARD_PAGES = {
  SELECT: 'select',
  CONFIGURE: 'configure',
  SCALING: 'scaling'
}
// Start on the select operation page
const page = ref(WIZARD_PAGES.SELECT)

const inputDescriptions = computed(() => { return selectedOperation.value.inputs })

// Text for the forward button changes based on the current page
const goForwardText = computed(() => {
  if (page.value == WIZARD_PAGES.SELECT) {
    return WIZARD_PAGES.SELECT
  }
  else if (page.value == WIZARD_PAGES.CONFIGURE){
    if (isInputScaling.value) {
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

// Text for the wizard title changes based on the current page
const wizardTitle = computed(() => {
  if (page.value == WIZARD_PAGES.SELECT) {
    return 'SELECT OPERATION'
  }
  else if (page.value == WIZARD_PAGES.SCALING) {
    return 'Configure ' + selectedOperation.value.name + ' Operation: Select scale points for each channel'
  }
  else if (page.value == WIZARD_PAGES.CONFIGURE && isInputScaling.value) {
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

// Bool to check if any of the operation inputs require image scaling, only for Color operation currently
const isInputScaling = computed(() => {
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
    if (isInputScaling.value) {
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
    else if (value.color_picker) {
      /**
       * Custom handling for color image operation
       * Since we can add and remove channels all inputs fall under the same key in an array of objects
       * Default: start with 3 channels (RGB) and try to preselect images for those
       */
      operationInputs.value[key] = Object.entries(rgbFilterMap).map(([color, filters]) => {
        const preselectedImage = props.images.find(image => filters.includes(image.filter.toLowerCase()))
        let output = {}
        if (preselectedImage) {
          output = {...preselectedImage}
        }
        output.color = colorRGBMap[color]
        return output
      })
    }
    else {
      operationInputs.value[key] = []
    }
  }
}

// Image dragged into the selected images area
function insertImage(inputKey, image, inputIndex=0) {
  const description = imageInputDescriptions.value[inputKey]
  if (!imageInputDescriptions.value[inputKey].color_picker) {
    const inputImages = operationInputs.value[inputKey]
    // skip if duplicate or invalid input key
    if (inputImages.includes(image) || !inputImages) return

    if(inputImages.length >= description.maximum) {
      inputImages.pop()
    }
    inputImages.push(image)
  }
  else {
    // inputImage is object (color inputs), so overwrite it with new one
    operationInputs.value[inputKey][inputIndex] = {
      ...operationInputs.value[inputKey][inputIndex],
      ...image
    }
  }
}

// Image removed from the selected images area
function removeImage(inputKey, image, inputIndex=0) {
  if (imageInputDescriptions.value[inputKey].color_picker) {
    operationInputs.value[inputKey][inputIndex] = {
      color: operationInputs.value[inputKey][inputIndex].color
    }
  }
  else{
    const inputImages = operationInputs.value[inputKey]

    if (!inputImages) return

    inputImages.splice(inputImages.indexOf(image), 1)
  }
}

function updateScaling(channelIndex, zmin, zmax) {
  // update the zmin/zmax for the operationInput channel
  const channel = operationInputs.value.color_channels[channelIndex]
  channel.zmin = zmin
  channel.zmax = zmax
}
</script>
<template>
  <v-card
    class="wizard-background"
    color="var(--primary-background)"
  >
    <v-toolbar
      color="var(--header)"
    >
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
              {{ selectedOperation.description }}
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
        <multi-image-input-selector
          :input-descriptions="imageInputDescriptions"
          :input-images="operationInputs"
          :images="props.images"
          :max-inputs="MAX_COLOR_CHANNELS"
          :min-inputs="MIN_COLOR_CHANNELS"
          @insert-image="insertImage"
          @remove-image="removeImage"
          @add-channel="() => {
            const colorChannels = operationInputs.color_channels
            if (colorChannels.length < MAX_COLOR_CHANNELS)
              colorChannels.push({ color: {r: 255, g: 0, b:255} })
          }"
          @remove-channel="() => {
            const colorChannels = operationInputs.color_channels
            if (colorChannels.length != MIN_COLOR_CHANNELS)
              operationInputs.color_channels.pop( )
          }"
          @update-channel-color="(index, color) => {
            operationInputs.color_channels[index].color = color
          }"
        />
        <div
          v-for="(inputDescription, inputKey) in inputDescriptions"
          :key="inputKey"
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
        v-if="page == WIZARD_PAGES.SCALING"
        class="wizard-card"
      >
        <wizard-scaling-page
          v-if="isInputComplete && inputDescriptions"
          :color-channels="operationInputs.color_channels"
          @update-scaling="updateScaling"
        />
      </v-card-text>
    </v-slide-y-reverse-transition>
    <div class="buttons-container d-flex ga-4">
      <v-btn
        prepend-icon="mdi-arrow-left"
        text="Back"
        color="var(--cancel)"
        @click="goBack"
      />
      <v-btn
        :disabled="disableGoForward"
        :text="goForwardText"
        color="var(--primary-interactive)"
        @click="goForward"
      />
    </div>
  </v-card>
</template>

<style scoped>
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

.wizard-background{
  max-height: 100vh;
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

.operation-input {
  margin-top: 2rem;
  width: 12rem;
}

.buttons-container {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
}
</style>
