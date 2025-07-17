<script setup>
import { defineProps, defineEmits } from 'vue'

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  trueIcon: {
    type: String,
    default: 'mdi-check'
  },
  falseIcon: {
    type: String,
    default: 'mdi-close'
  }
})

defineEmits(['update:modelValue'])

</script>
<template>
  <v-switch
    :model-value="modelValue"
    inset
    hide-details
    color="var(--primary-interactive)"
    base-color="var(--primary-interactive)"
    :false-icon="falseIcon"
    :true-icon="trueIcon"
    icon-color="var(--text)"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
<style scoped>
.v-switch >>> .v-switch__track{
  opacity: 0.8;
}
.v-switch >>> .v-switch__thumb{
  background-color: var(--primary-interactive);
}
.v-switch >>> i.v-icon.v-icon{
  color: var(--text);
  font-size: 1.2rem;

}
</style>
