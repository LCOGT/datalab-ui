<!-- eslint-disable vue/require-prop-types -->
<script setup>

defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  dialogTitle: {
    type: String,
    required: true
  },
  dialogBody: {
    type: String,
    required: true
  },
  onDelete: {
    type: Function,
    required: true
  },
})
const emit = defineEmits(['update:modelValue'])

function closeDialog() { 
  emit('update:modelValue', false)
}

</script>
<template>
  <!-- Shared dialog used to confirm deleting of items -->
  <v-dialog
    :model-value="modelValue"
    persistent
    width="auto"
  >
    <v-card class="delete-card">
      <v-card-title
        class="text-h5"
      >
        <p class="delete-item-text">
          {{ dialogTitle }}
        </p>
      </v-card-title>
      <v-card-text>
        <p class="delete-text">
          <span v-html="dialogBody" />
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          class="close-btn"
          @click="closeDialog()"
        >
          go back
        </v-btn>
        <v-btn
          class="delete-btn"
          @click="onDelete()"
        >
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.delete-card {
  background-color: var(--primary-background);
}
.delete-item-text {
  color: var(--cancel);
  font-family: var(--font-stack);
  letter-spacing: 0.1rem;
  font-weight: 600;
  font-size: 1.3rem;
}
.delete-text {
  color: var(--text);
  font-family: var(--font-stack);
  font-size: 1.2rem;
}
.close-btn {
  color: var(--primary-interactive);
  font-size: 1rem;
}
.delete-btn {
  color: var(--cancel);
  font-size: 1rem;
}
</style>
