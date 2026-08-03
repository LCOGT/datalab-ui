<script setup>
import { computed } from 'vue'

/*
  Numeric range controls for cluster membership selection (design doc v1: no drag/box
  selection). A star is a member when its Gaia proper motion falls within pm_radius of
  the (pmra, pmdec) center and its parallax falls inside [parallax_min, parallax_max]
  (the parallax window is optional). The parent owns the selection object and the
  member flags; this component only edits the selection.
*/

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  // the backend's suggested selection, when it found a proper motion clump
  membershipGuess: {
    type: Object,
    default: null
  },
  memberCount: {
    type: Number,
    default: null
  },
  totalStars: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const filteringActive = computed(() => props.memberCount !== null)

function setField(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function useSuggestion() {
  // default the distance window keys to null so they're always present, then let the guess
  // (which now also carries distance_min / distance_max when it found them) fill them in
  emit('update:modelValue', { distance_min: null, distance_max: null, ...props.membershipGuess })
}

function clearSelection() {
  emit('update:modelValue', {
    pmra: null, pmdec: null, pm_radius: null,
    parallax_min: null, parallax_max: null,
    distance_min: null, distance_max: null
  })
}
</script>
<template>
  <v-sheet
    class="membership-controls pa-3 d-flex flex-wrap align-center ga-3"
    color="var(--card-background)"
    rounded
  >
    <span class="controls-title">CLUSTER MEMBERSHIP</span>
    <v-number-input
      :model-value="props.modelValue.pmra"
      label="pmRA (mas/yr)"
      :precision="null"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('pmra', $event)"
    />
    <v-number-input
      :model-value="props.modelValue.pmdec"
      label="pmDec (mas/yr)"
      :precision="null"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('pmdec', $event)"
    />
    <v-number-input
      :model-value="props.modelValue.pm_radius"
      label="PM radius (mas/yr)"
      :precision="null"
      :min="0"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('pm_radius', $event)"
    />
    <v-number-input
      :model-value="props.modelValue.parallax_min"
      label="parallax min (mas)"
      :precision="null"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('parallax_min', $event)"
    />
    <v-number-input
      :model-value="props.modelValue.parallax_max"
      label="parallax max (mas)"
      :precision="null"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('parallax_max', $event)"
    />
    <v-number-input
      :model-value="props.modelValue.distance_min"
      label="distance min (pc)"
      :precision="null"
      :min="0"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('distance_min', $event)"
    />
    <v-number-input
      :model-value="props.modelValue.distance_max"
      label="distance max (pc)"
      :precision="null"
      :min="0"
      control-variant="hidden"
      density="compact"
      hide-details
      class="membership-input"
      @update:model-value="setField('distance_max', $event)"
    />
    <v-btn
      v-if="props.membershipGuess"
      text="Use Suggestion"
      size="small"
      color="var(--primary-interactive)"
      @click="useSuggestion"
    />
    <v-btn
      text="Clear"
      size="small"
      color="var(--cancel)"
      @click="clearSelection"
    />
    <span
      v-if="filteringActive"
      class="member-count"
    >
      {{ props.memberCount }} / {{ props.totalStars }} members
    </span>
    <span
      v-else
      class="member-count"
    >
      no selection - showing all {{ props.totalStars }} stars
    </span>
  </v-sheet>
</template>

<style scoped>
.membership-controls {
  color: var(--text);
  width: min(100%, 1120px);
  align-self: center;
}
.controls-title {
  font-weight: 600;
  letter-spacing: 0.05rem;
  font-size: 0.9rem;
}
.membership-input {
  min-width: 9.5rem;
  max-width: 11rem;
}
.member-count {
  margin-left: auto;
  font-size: 0.9rem;
  color: var(--text);
}
</style>
