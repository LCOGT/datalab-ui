<script setup>
import { computed, ref } from 'vue'
import CalibrationComparisonPlot from '@/components/Global/CalibrationComparisonPlot.vue'
import { normalizeLightCurveRows } from '@/utils/lightCurve.js'

const VALIDATION_ROW_PREFIX = 'comparison-star validation row:'
const VALIDATION_HEADER_PREFIX = 'comparison star identifier |'

const props = defineProps({
  operationOutput: {
    type: Object,
    default: () => ({})
  }
})

const expandedDiagnosticImage = ref(null)

const normalizedLightCurveRows = computed(() => normalizeLightCurveRows(props.operationOutput?.light_curve))

// Turns the backend's `diagnostics` map (keyed by FITS basename) into one section per file,
// splitting the comparison-star validation rows out of the free-form notes and pairing each
// file with its overlay image and its light curve row.
const diagnosticSections = computed(() => {
  return Object.entries(props.operationOutput?.diagnostics || {}).map(([fileName, sectionDiagnostics]) => {
    const rows = sectionDiagnostics
      .filter(diagnostic => typeof diagnostic === 'string' && diagnostic.startsWith(VALIDATION_ROW_PREFIX))
      .map(parseComparisonValidationRow)
      .filter(Boolean)

    const notes = sectionDiagnostics.filter(diagnostic => {
      if (typeof diagnostic !== 'string') return true
      return !diagnostic.startsWith(VALIDATION_ROW_PREFIX) && !diagnostic.startsWith(VALIDATION_HEADER_PREFIX)
    })

    return {
      fileName,
      rows,
      notes,
      target: targetForFile(fileName),
      diagnosticImage: diagnosticImageForFile(fileName),
    }
  })
})

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
  const rowText = diagnostic.replace(VALIDATION_ROW_PREFIX, '').trim()
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
</script>
<template>
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
              title="Click to view at full resolution"
              @click.stop="expandedDiagnosticImage = { url: section.diagnosticImage, fileName: section.fileName }"
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
  <v-dialog
    :model-value="expandedDiagnosticImage !== null"
    fullscreen
    @update:model-value="expandedDiagnosticImage = null"
  >
    <v-card
      color="var(--card-background)"
      class="expanded-image-card"
      :ripple="false"
      @click="expandedDiagnosticImage = null"
    >
      <v-card-title class="expanded-image-title">
        <span class="diagnostics-file-title">{{ expandedDiagnosticImage?.fileName }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="compact"
          title="Close"
          @click="expandedDiagnosticImage = null"
        />
      </v-card-title>
      <v-card-text class="expanded-image-viewport">
        <img
          v-if="expandedDiagnosticImage"
          :src="expandedDiagnosticImage.url"
          :alt="`${expandedDiagnosticImage.fileName} candidate star overlay at full resolution`"
          crossorigin="anonymous"
          class="expanded-image"
        >
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
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
  cursor: zoom-in;
}

/* Anywhere on the expanded view closes it, so the whole surface shows the zoom-out cursor. */
.expanded-image-card {
  cursor: zoom-out;
}

.expanded-image-title {
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Fills the dialog under the title bar and scrolls when the overlay is wider or taller
   than the window, since the image inside is drawn at its native pixel size. */
.expanded-image-viewport {
  height: calc(100vh - 64px);
  overflow: auto;
  background: #000;
}

.expanded-image {
  display: block;
  margin: 0 auto;
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
</style>
