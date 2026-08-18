import AperturePhotometryDiagnostics from '@/components/Global/diagnostics/AperturePhotometryDiagnostics.vue'
import HRDiagramDiagnostics from '@/components/Global/diagnostics/HRDiagramDiagnostics.vue'

// Diagnostics are operation specific: each operation lays its own out however it wants.
// Entries are keyed by the operation name the backend reports (DataOperation.name()).
//
// To add diagnostics for a new operation, write a <Operation>Diagnostics.vue in this
// directory taking an `operationOutput` prop, and register it below.
const DIAGNOSTICS_VIEWS = {
  'Aperture Photometry': AperturePhotometryDiagnostics,
  'HR Diagram': HRDiagramDiagnostics,
}

function diagnosticsViewFor(operationOutput) {
  return DIAGNOSTICS_VIEWS[operationOutput?.operationName] || null
}

export { diagnosticsViewFor }
