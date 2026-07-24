<script setup>
import { computed, ref } from 'vue'
import FilterBadge from './FilterBadge.vue'
import CalibrationComparisonPlot from '@/components/Global/CalibrationComparisonPlot.vue'
import { lightCurveMagnitudes, normalizeLightCurveRows } from '@/utils/lightCurve.js'

const props = defineProps({
  operationOutput: {
    type: Object,
    default: () => {}
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  enableCards: {
    type: Boolean,
    default: true
  },
  enableRemoval: {
    type: Boolean,
    default: false
  }
})

const lightCurveSparkline = computed(() => {
  if (props.operationOutput.light_curve) {
    return lightCurveMagnitudes(props.operationOutput.light_curve)
  }
  return []
})

const diagnosticsDialog = ref(false)

const diagnosticSections = computed(() => {
  return Object.entries(props.operationOutput?.diagnostics || {}).map(([fileName, sectionDiagnostics]) => {
    return buildDiagnosticSection(fileName, sectionDiagnostics)
  })
})

const hasDiagnostics = computed(() => {
  return diagnosticSections.value.some(section => {
    return section.rows.length || section.notes.length || section.diagnosticImage
  })
})

const normalizedLightCurveRows = computed(() => normalizeLightCurveRows(props.operationOutput?.light_curve))

function buildDiagnosticSection(fileName, sectionDiagnostics) {
  const rows = sectionDiagnostics
    .filter(diagnostic => typeof diagnostic === 'string' && diagnostic.startsWith('comparison-star validation row:'))
    .map(parseComparisonValidationRow)
    .filter(Boolean)

  const notes = sectionDiagnostics.filter(diagnostic => {
    if (typeof diagnostic !== 'string') return true
    return !diagnostic.startsWith('comparison-star validation row:') &&
      !diagnostic.startsWith('comparison star identifier |')
  })

  return {
    fileName,
    rows,
    notes,
    target: targetForFile(fileName),
    diagnosticImage: diagnosticImageForFile(fileName),
  }
}

function diagnosticImageForFile(fileName) {
  const images = props.operationOutput?.diagnostic_images
  if (!images || Array.isArray(images) || typeof images !== 'object') return null

  const imageUrl = images[fileName] || Object.entries(images).find(([imageFileName]) => {
    return fitsPathMatches(imageFileName, fileName)
  })?.[1]
  return imageUrl || null
}

function targetForFile(fileName) {
  const lightCurveRow = normalizedLightCurveRows.value.find(row => fitsPathMatches(row.fits_path, fileName))
  if (!lightCurveRow) return null
  return {
    magnitude: lightCurveRow.mag,
    flux: lightCurveRow.target_net_source_counts,
  }
}

function fitsPathMatches(fitsPath, fileName) {
  if (!fitsPath || !fileName) return false
  const fitsText = String(fitsPath)
  const fileText = String(fileName)
  return fitsText === fileText || fitsText.endsWith(fileText) || fileText.endsWith(fitsText.split('/').pop())
}

function parseComparisonValidationRow(diagnostic) {
  const rowText = diagnostic.replace('comparison-star validation row:', '').trim()
  const fields = rowText.split('|').map(field => field.trim())
  if (fields.length !== 7) return null

  return {
    identifier: fields[0],
    ra: fields[1],
    dec: fields[2],
    calculatedFlux: fields[3],
    catalogFlux: fields[4],
    calculatedMagnitude: fields[5],
    catalogMagnitude: fields[6],
  }
}

function formatDiagnosticTitle(diagnostic) {
  if (diagnostic === null || diagnostic === undefined) return 'No diagnostic detail'
  if (typeof diagnostic === 'string') return diagnostic
  if (typeof diagnostic !== 'object') return String(diagnostic)
  return diagnostic.message || diagnostic.title || diagnostic.name || 'Diagnostic'
}

function formatDiagnosticDetails(diagnostic) {
  if (!diagnostic || typeof diagnostic !== 'object') return ''
  return Object.entries(diagnostic)
    .filter(([key]) => !['message', 'title', 'name'].includes(key))
    .map(([key, value]) => `${formatDiagnosticKey(key)}: ${formatDiagnosticValue(value)}`)
    .join('\n')
}

function formatDiagnosticKey(key) {
  return key.replaceAll('_', ' ')
}

function formatDiagnosticValue(value) {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const periodogramSparkline = computed(() => {
  if (props.operationOutput.power) {
    return props.operationOutput.power
  }
  return []
})

const title = computed (() => {
  let text = ''
  if (props.operationOutput?.source) {
    text = props.operationOutput.source?.name
  }
  else {
    text = props.operationOutput?.operationName
  }
  return text
})

const emit = defineEmits(['selectOperationOutput', 'launchAnalysis', 'removeOperationOutput', 'removeImage'])

</script>
<template>
  <v-sheet
    v-if="props.operationOutput"
    class="pa-1 annotated-output"
    color="var(--secondary-background)"
    :elevation="2"
    rounded
    :class="{ 'selected-output': isSelected }"
    @click="emit('selectOperationOutput', props.operationOutput)"
  >
    <v-card density="compact">
      <v-card-title class="output-title">
        <filter-badge
          v-if="props.operationOutput.filter"
          :filter="props.operationOutput.filter"
        />
        <p class="ml-2 output-title-text">
          {{ props.operationOutput.operationName }}
        </p>
      </v-card-title>
      <v-card-text class="p-1">
        <v-sparkline
          v-if="props.operationOutput.light_curve" 
          v-model="lightCurveSparkline"
        />
        <v-sparkline
          v-if="props.operationOutput.power" 
          v-model="periodogramSparkline"
        />
        <p v-if="props.operationOutput.period">
          {{ props.operationOutput.period.toFixed(4) }} days
        </p>
        <span
          v-if="props.enableRemoval"
          class="removal-button-overlay"
        >
          <v-btn
            density="compact"
            icon="mdi-close"
            @click="emit('removeImage', props.image)"
          />
        </span>
      </v-card-text>
    </v-card>
    <div
      v-if="props.enableCards"
      class="d-flex flex-row ga-2 align-center mt-2"
    >
      <p class="text-subtitle-2 mr-auto prevent-select single-line-text">
        {{ title }}
      </p>
      <v-icon
        v-if="hasDiagnostics"
        icon="mdi-information-outline"
        color="var(--info)"
        title="View diagnostics"
        @click.stop="diagnosticsDialog = true"
      />
      <v-icon
        icon="mdi-eye"
        color="var(--primary-interactive)"
        @click.stop="emit('launchAnalysis', props.operationOutput)"
      />
    </div>
    <v-dialog
      v-model="diagnosticsDialog"
      max-width="920"
    >
      <v-card color="var(--card-background)">
        <v-card-title class="diagnostics-title">
          Diagnostics
        </v-card-title>
        <v-card-text>
          <v-expansion-panels
            variant="accordion"
            class="diagnostics-panels"
          >
            <v-expansion-panel
              v-for="section in diagnosticSections"
              :key="section.fileName"
              class="diagnostics-panel"
            >
              <v-expansion-panel-title>
                <span class="diagnostics-file-title">{{ section.fileName }}</span>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <section
                  v-if="section.rows.length"
                  class="diagnostics-section"
                >
                  <h3 class="diagnostics-section-title">
                    Comparison Star Validation
                  </h3>
                  <v-table
                    density="compact"
                    class="diagnostics-table"
                  >
                    <thead>
                      <tr>
                        <th>Candidate ID</th>
                        <th class="numeric-column">
                          RA
                        </th>
                        <th class="numeric-column">
                          Dec
                        </th>
                        <th class="numeric-column">
                          Flux
                        </th>
                        <th class="numeric-column">
                          Catalog Flux
                        </th>
                        <th class="numeric-column">
                          Mag
                        </th>
                        <th class="numeric-column">
                          Catalog Mag
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in section.rows"
                        :key="section.fileName + '-' + row.identifier"
                      >
                        <td>{{ row.identifier }}</td>
                        <td class="numeric-column">
                          {{ row.ra }}
                        </td>
                        <td class="numeric-column">
                          {{ row.dec }}
                        </td>
                        <td class="numeric-column">
                          {{ row.calculatedFlux }}
                        </td>
                        <td class="numeric-column">
                          {{ row.catalogFlux }}
                        </td>
                        <td class="numeric-column">
                          {{ row.calculatedMagnitude }}
                        </td>
                        <td class="numeric-column">
                          {{ row.catalogMagnitude }}
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div
                    v-if="section.diagnosticImage"
                    class="diagnostic-overlay"
                  >
                    <h3 class="diagnostics-section-title">
                      Candidate Star Overlay
                    </h3>
                    <img
                      :src="section.diagnosticImage"
                      :alt="`${section.fileName} candidate star overlay`"
                      crossorigin="anonymous"
                      class="diagnostic-overlay-image"
                    >
                  </div>
                  <calibration-comparison-plot
                    :rows="section.rows"
                    :target="section.target"
                  />
                </section>
                <section
                  v-if="section.notes.length"
                  class="diagnostics-section"
                >
                  <h3 class="diagnostics-section-title">
                    Notes
                  </h3>
                  <v-list
                    density="compact"
                    bg-color="transparent"
                  >
                    <v-list-item
                      v-for="(diagnostic, index) in section.notes"
                      :key="index"
                      :title="formatDiagnosticTitle(diagnostic)"
                      :subtitle="formatDiagnosticDetails(diagnostic)"
                      class="diagnostic-item"
                    />
                  </v-list>
                </section>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text="Close"
            color="var(--primary-interactive)"
            @click="diagnosticsDialog = false"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-sheet>
  <v-skeleton-loader
    v-else
    type="card"
    color="var(--secondary-background)"
    bg-color="var(--primary-background)"
  />
</template>

<style scoped>
.output-title {
  padding: 0 0 0 0;
  display: flex;
}

.output-title-text {
  align-content: center;
}

.diagnostics-title {
  color: var(--text);
}

.diagnostics-section {
  margin-bottom: 1rem;
}

.diagnostics-panels {
  background: transparent;
}

.diagnostics-panel {
  background-color: var(--secondary-background);
  color: var(--text);
}

.diagnostics-file-title {
  color: var(--text);
  font-family: monospace;
  font-size: 0.85rem;
}

.diagnostics-section-title {
  color: var(--text);
  font-family: var(--font-stack);
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  text-transform: none;
}

.diagnostics-table {
  background-color: var(--secondary-background);
  color: var(--text);
  border-radius: 8px;
  overflow: hidden;
}

.diagnostic-overlay {
  margin-top: 1rem;
}

.diagnostic-overlay-image {
  display: block;
  max-width: 100%;
  max-height: 360px;
  margin: 0 auto;
  border-radius: 8px;
  background: #000;
}

.diagnostics-table :deep(th) {
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  text-align: center !important;
  vertical-align: middle;
}

.diagnostics-table :deep(td) {
  color: var(--text);
  font-family: monospace;
  font-size: 0.8rem;
  white-space: nowrap;
  text-align: center;
  vertical-align: middle;
}

.numeric-column {
  text-align: center;
}

.diagnostic-item {
  white-space: pre-line;
}

.annotated-output {
  max-width: 200px;
  min-width: 120px;
  width: 100%;
}

.selected-output {
  outline: 0.3rem solid var(--primary-interactive);
}

.removal-button-overlay {
  color: var(--text);
  font-weight: bold;
  right: 5px;
  bottom: 5px;
  position: absolute;
}
</style>
