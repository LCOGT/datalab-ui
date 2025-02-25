<script setup>
import OperationNode from '@/components/DataSession/OperationGraph/OperationNode.vue'
import ImagesNode from '@/components/DataSession/OperationGraph/ImagesNode.vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { nextTick, ref, watch } from 'vue'
import { useLayout } from '@/components/DataSession/OperationGraph/useLayout.js'


const props = defineProps({
  operations: {
    type: Array,
    required: true
  },
  images: {
    type: [Array, Boolean],
    default: false
  },
  sessionId: {
    type: Number,
    required: true
  },
  selectedOperation: {
    type: Number,
    required: true
  },
  active: {
    type: Boolean,
    required: true
  }
})

const nodes = ref([])
const edges = ref([])
const { layout } = useLayout()
const emit = defineEmits(['selectOperation', 'closeGraph'])

function selectOperation(index) {
  emit('selectOperation', Number(index))
}

const { fitView, onPaneReady } = useVueFlow({id: 'operations-pipeline-vue-flow'})

function getEdgeProps(source, target) {
  if(target == props.selectedOperation.toString()) {
    return {style: { stroke: 'violet', strokeWidth: '2px' }, animated: true}
  }
  else if(source == props.selectedOperation.toString()) {
    return {style: { stroke: 'green', strokeWidth: '2px' }, animated: true}
  }
  else {
    return {style: { stroke: 'lightgrey', strokeWidth: '1px' }, animated: false}
  }
}

function nodeUpdate() {
  // This is called when nodes and edges have been created to lay them out
  nodes.value = layout(nodes.value, edges.value)
  // Examples show letting VueFlow have a cycle after layout before calling fitView, not sure why
  nextTick(() =>{
    fitView()
  })
}

function updateNodesAndEdges() {
  if (props.active) {
    nodes.value = []
    edges.value = []

    // Operations should have a dependencies property set which helps us build the edges of the graph
    props.operations.forEach((operation) => {
      nodes.value.push({
        id: operation.id.toString(),
        type: 'operation',
        data: operation,
        position: {x: 0, y: 50}  // Initial position must be provided or layout freaks out
      })
    })
    props.operations.forEach((operation) => {
      operation.dependencies.forEach((dependency) => {
        let edgeId = 'e' + dependency + '->' + operation.id
        edges.value.push({
          id: edgeId,
          source: dependency.toString(),
          target: operation.id.toString(),
          type: 'smoothstep',
          ...getEdgeProps(dependency.toString(), operation.id.toString())
        })
      })
    })
    // Must let VuewFlow have a cycle to setup initial positions of nodes before laying out
    nextTick(() =>{
      nodeUpdate()
    })
  }
}

watch(() => props.operations, () => {
  // Whenever operations are updated, re-create the nodes and edges and lay them out
  updateNodesAndEdges()
}, { immediate: false }
)

watch(() => props.selectedOperation, () => {
  if(props.selectedOperation == -1) {
    // Set all edges to grey
    edges.value.forEach(edge => {
      if(edge.style.stroke != 'lightgrey') {
        edge.style = { stroke: 'lightgrey', strokeWidth: '1px' }
        edge.animated = false
      }
    })
  }
  else {
    // Color the incoming and outgoing edges from the selected operation node
    edges.value.forEach(edge => {
      const edgeProps = getEdgeProps(edge.source, edge.target)
      edge.style = edgeProps.style
      edge.animated = edgeProps.animated
    })
  }
})

onPaneReady(() => {
  updateNodesAndEdges()
})

</script>
<template>
  <VueFlow
    id="operations-pipeline-vue-flow"
    v-model:nodes="nodes"
    v-model:edges="edges"
    :nodes-draggable="false"
    :snap-to-grid="true"
    :elements-selectable="false"
    class="operation-pipeline-node-flow"
  >
    <Background pattern-color="var(--light-blue)" />
    <template #node-operation="item">
      <OperationNode
        :id="item.id"
        :selected-id="props.selectedOperation"
        :data="item.data"
        @select-operation="selectOperation(item.id)"
      />
    </template>
    <template #node-images="item">
      <ImagesNode
        :id="item.id"
        :data="item.data"
      />
    </template>
    <Panel position="top-right">
      <v-btn
        color="var(--light-blue)"
        title="Close Graph"
        density="default"
        icon="mdi-arrow-right-bold"
        @click="emit('closeGraph')"
      />
    </Panel>
  </VueFlow>
</template>
<style>

</style>
