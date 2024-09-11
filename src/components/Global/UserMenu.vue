<script setup>
import { useUserDataStore } from '@/stores/userData'

const userDataStore = useUserDataStore()

function logOut() {
  userDataStore.username = ''
  userDataStore.authToken = ''
  userDataStore.profile = {}
  userDataStore.proposals = []
  location.reload()
}
</script>

<template>
  <div class="user-menu">
    <v-menu>
      <template #activator="{ props }">
        <v-btn
          class="nav-text"
          v-bind="props"
          append-icon="mdi-account-circle"
        >
          {{ userDataStore.username }}
        </v-btn>
      </template>

      <v-card
        color="var(--metal)"
        class="nav-text"
      >
        <v-list-item>
          Account
        </v-list-item>
        <v-list-item>
          <v-btn
            append-icon="mdi-arrow-right"
            variant="text"
            text="Logout"
            @click="logOut"
          />
        </v-list-item>
        <v-list-item>
          Settings
        </v-list-item>
        <v-list-item>
          <v-switch
            v-model="userDataStore.carouselGridToggle"
            class="d-flex"
            prepend-icon="mdi-view-list"
            append-icon="mdi-image"
          />
        </v-list-item>
        <v-list-item>
          <v-switch
            v-model="userDataStore.isColorblindMode"
            label="High Contrast"
          />
        </v-list-item>
      </v-card>
    </v-menu>
  </div>
</template>
<style scoped>
  .nav-text {
  font-weight: 600;
  font-size: 1rem;
  }
</style>
