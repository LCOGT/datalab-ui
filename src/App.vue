<script setup>
import { ref, provide } from 'vue';


const selectedImages = ref([]);
provide('selectedImages', selectedImages);
</script>

<template>
  <div>
    <router-view></router-view>
  </div>
</template>

<style>
</style>
