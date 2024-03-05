<script setup>
import { defineProps, ref} from 'vue'
// eslint-disable-next-line no-unused-vars
const props = defineProps(['imageSrc'])
const image = ref(null)
const imageLeftPos = ref(0)
const imageTopPos = ref(0)
const currentZoom = ref(1)

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const STEP_SIZE = 0.1
let mouseX
let mouseY

const zoom = (e, direction) => {
	if (!direction) direction = e.deltaY > 0 ? -1 : 1
	let newZoom = currentZoom.value + direction * STEP_SIZE 
	if (newZoom > MIN_ZOOM && newZoom < MAX_ZOOM) currentZoom.value = newZoom
}

// save the position clicked and add the pointermove listener
const pointerDown = (e) => {
	mouseX = e.pageX
	mouseY = e.pageY
	image.value.onpointermove = pointerMove
}

// use mouse movement delta to set position, limit so image stays on screen
const pointerMove = (e) => {
	let x = imageLeftPos.value+e.pageX-mouseX
	let y = imageTopPos.value+e.pageY-mouseY
	// TODO change this to be bounded by the condition of whether overflow will happen for a more natural use
	if( x > -800 && x < 800) imageLeftPos.value   = x
	if( y > -800 && y < 800) imageTopPos.value    = y
	mouseX = e.pageX
	mouseY = e.pageY
}

</script>
<template>
  <div
    class="image_container"
    :style="{height: image?.naturalHeight, width: image?.naturalWidth}"
  >
    <img
      ref="image"
      :src="imageSrc"
      class="image"
      :style="{left:imageLeftPos+'px', top:imageTopPos+'px', transform: `scale(${currentZoom})`}"
      @wheel="zoom"
      @pointerdown.prevent="pointerDown"
      @pointerup="image.onpointermove = null"
      @pointerleave="image.onpointermove = null"
    >
    <v-btn-group class="zoom_buttons">
      <v-btn
        icon="mdi-magnify-plus"
        variant="plain"
        @click="zoom(e, 1)"
      />
      <v-btn
        icon="mdi-magnify-minus"
        variant="plain"
        @click="zoom(e, -1)"
      />
    </v-btn-group>
  </div>
</template>
<style scoped>
.image{
	position: relative;
	top: 0px;
	left: 0px;
}
.image:hover{
	cursor: grab;
}
.image_container{
	border: 4px solid #d2d2d2;
	background-color: black;
	position: relative;
	overflow: hidden;
}
.zoom_buttons{
	position: absolute;
	bottom: 0;
	right: 0;
}
</style>
