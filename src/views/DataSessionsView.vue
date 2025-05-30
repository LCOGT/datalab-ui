<script setup>
import { ref, onMounted } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useUserDataStore } from '@/stores/userData'
import { fetchApiCall, handleError } from '../utils/api'
import DataSession from '@/components/DataSession/DataSession.vue'
import DeleteSessionDialog from '@/components/DataSession/DeleteSessionDialog.vue'

const configurationStore = useConfigurationStore()
const userDataStore = useUserDataStore()
const dataSessions = ref([])
const deleteSessionId = ref(-1)
const showDeleteDialog = ref(false)
const dataSessionsUrl = configurationStore.datalabApiBaseUrl + 'datasessions/'

onMounted(async () => {
  await loadSessions()
  // if there is no active session set the first session default
  if (dataSessions.value.length > 0 && !userDataStore.activeSessionId) {
    userDataStore.activeSessionId = dataSessions.value[0].id
  }
})

function onTabChange(newSessionId) {
  userDataStore.activeSessionId = newSessionId
}

function openDeleteDialog(id) {
  deleteSessionId.value = id
  showDeleteDialog.value = true
}

async function loadSessions() {
  await fetchApiCall({ url: dataSessionsUrl, method: 'GET', successCallback: updateData, failCallback: handleError })
}

// if tab is not in new data default to displaying first tab
function updateData(data) {
  dataSessions.value = data.results
  if (!dataSessions.value.some(ds => ds.id == userDataStore.activeSessionId)) {
    userDataStore.activeSessionId = dataSessions.value[0]?.id
  }
}

function tabActive(index) {
  // checks if this tabs id is the active session id
  return dataSessions.value[index] && userDataStore.activeSessionId === dataSessions.value[index].id
}

</script>

<template>
  <v-container
    v-if="dataSessions.length != 0"
    class="d-lg datasession-container"
  >
    <v-tabs
      v-model="userDataStore.activeSessionId"
      class="tabs"
      next-icon="mdi-chevron-right"
      prev-icon="mdi-chevron-left"
      show-arrows
      hide-slider
      center-active
      @update:model-value="onTabChange"
    >
      <v-tab
        v-for="(ds, index) in dataSessions"
        :key="ds.id"
        :value="ds.id"
        :class="{ selected: tabActive(index) }"
        class="pr-0 tab"
      >
        {{ ds.name }}
        <v-btn
          variant="plain"
          size="small"
          icon="mdi-close"
          color="var(--cancel)"
          class="tab_button"
          @click="openDeleteDialog(ds.id)"
        />
      </v-tab>
    </v-tabs>
    <v-window v-model="userDataStore.activeSessionId">
      <v-window-item
        v-for="(ds, index) in dataSessions"
        :key="ds.id"
        :value="ds.id"
      >
        <data-session
          :data="ds"
          :active="tabActive(index)"
        />
      </v-window-item>
    </v-window>
    <delete-session-dialog
      v-model="showDeleteDialog"
      :session-id="deleteSessionId"
      @item-was-deleted="loadSessions()"
    />
  </v-container>
  <div
    v-else
    class="no-sessions mt-15 d-flex flex-column justify-center align-center"
  >
    <v-icon
      icon="mdi-space-invaders"
      :size="100"
    />
    <h1>No Data Sessions to Display</h1>
    <p>Head over to the Projects tab and select some images to create one!</p>
  </div>
</template>

<style scoped>
.tabs {
  background-color: var(--primary-background);
  border-bottom: 0.1rem solid var(--primary-interactive);
}

.tab {
  font-size: 1.2rem;
  text-decoration: none;
  color: var(--disabled-text);
  font-weight: 600;
  background-color: var(--secondary-background);
}

.tab_button {
  color: var(--text);
  margin: 0 0.5rem;
}

.selected {
  background-color: var(--primary-interactive);
  color: var(--text);
}

.no-sessions{
  font-weight: 600;
  color: var(--text);
}

@media (max-width: 1200px) {
  .datasession-container {
    width: 85vw;
    justify-content: left;
  }

  .tab {
    font-size: 0.85rem;
  }

  .tab_button {
    margin: 0;
  }
}

@media (max-width: 900px) {
  .datasession-container {
    width: 80vw;
  }
}
</style>
