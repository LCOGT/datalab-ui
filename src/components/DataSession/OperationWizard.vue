<script setup>
import { ref, onMounted, computed} from 'vue'
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
const operationInputs = ref({})
const IMAGES_PER_ROW = 3

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

function sortImagesByFilter(filters, images){
  // Trim and lowercase all filters
  for (const filter in filters){
    filters[filter] = filters[filter].trim().toLowerCase()
  }
  // Place desired filters at the front, followed by the rest
  return [
    ...images.filter(image => filters.includes(image.filter?.trim().toLowerCase())),
    ...images.filter(image => !filters.includes(image.filter?.trim().toLowerCase()))
  ]
}

function validatedImages(inputDescription) {
  try {
    const validatedImages = props.images.filter(image => {
      // archive images have no type (assigned in backend outputs) so we accept null for 'fits' format
      const inputIsFormatFitsAndArchiveImage = inputDescription.type == 'fits' && image.type == null
      return (inputIsFormatFitsAndArchiveImage || image.type == inputDescription.type)
    })

    // If the input has a filter, sort the images by that filter
    if(inputDescription.filter) 
      return sortImagesByFilter(inputDescription.filter, validatedImages)
    else
      return validatedImages

  } catch (error) {
    console.log('Error validating images:', error)
    return props.images // fallback to all images
  }
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

function selectImage(inputKey, basename) {
  const inputKeyImages = operationInputs.value[inputKey]
  const input = inputDescriptions.value[inputKey]
  const image = props.images.find(image => image.basename == basename)

  // If the image is already selected, remove it from the list
  if (inputKeyImages.includes(image)) {
    inputKeyImages.splice(inputKeyImages.indexOf(image), 1)
  }
  // If image not selected and maxImages isn't reached, add to the list
  else if (!input.maximum || inputKeyImages.length < input.maximum) {
    inputKeyImages.push(image)
  }
  else {
    alert.setAlert('warning', `${input.name} can only have ${input.maximum} image(s) selected`)
  }
}

function selectOperation(name) {
  selectedOperation.value = availableOperations.value[name]
  operationInputs.value = {}
  for (const [key, value] of Object.entries(inputDescriptions.value)) {
    if ('default' in value) {
      operationInputs.value[key] = value.default
    }
    else {
      operationInputs.value[key] = []
    }
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
          <div v-else-if="inputDescription.type == 'fits'">
            <div
              v-if="inputDescription.name"
              class="input-images"
            >
              {{ inputDescription.name }}
            </div>
            <image-grid
              v-if="operationInputs[inputKey]"
              :images="validatedImages(inputDescription)"
              :selected-images="operationInputs[inputKey].map(image => image.basename)"
              :column-span="calculateColumnSpan(images.length, IMAGES_PER_ROW)"
              :allow-selection="true"
              @select-image="selectImage(inputKey, $event)"
            />
          </div>
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
