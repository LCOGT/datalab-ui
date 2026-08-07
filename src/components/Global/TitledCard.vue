<script setup>

/*
  An outlined card whose title sits on top of the outline in the upper left corner, fieldset
  legend style. The title paints its own background so it interrupts the border line it
  overlaps - that background has to match whatever the card is sitting on, so it is a prop
  defaulting to the page background. The card contents are templated out to the caller.
*/

defineProps({
  title: {
    type: String,
    required: true
  },
  // background behind the title text, matched to the surface the card sits on so the
  // outline reads as broken rather than struck through
  titleBackground: {
    type: String,
    default: 'var(--primary-background)'
  }
})

</script>
<template>
  <v-card
    variant="outlined"
    class="titled-card"
  >
    <v-card-title
      class="titled-card-title"
      :style="{ backgroundColor: titleBackground }"
    >
      {{ title }}
    </v-card-title>
    <v-card-text class="titled-card-text">
      <slot />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.titled-card {
  overflow: visible;
  margin-top: 0.75rem;
  border-color: color-mix(in srgb, var(--text) 25%, transparent);
}

.titled-card-title {
  position: absolute;
  top: 0;
  left: 0.75rem;
  transform: translateY(-50%);
  padding: 0 0.5rem;
  color: var(--text);
  font-family: var(--font-stack);
  font-size: 1.2rem;
  font-weight: bold;
  line-height: 1.2;
  text-transform: none;
}

.titled-card-text {
  color: var(--text);
  padding-top: 1rem;
}
</style>
