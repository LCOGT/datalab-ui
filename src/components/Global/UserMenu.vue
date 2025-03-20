<script setup>
import { useUserDataStore } from '@/stores/userData'
import { useRouter } from 'vue-router'

const userDataStore = useUserDataStore()
const router = useRouter()

function logOut() {
  userDataStore.username = ''
  userDataStore.authToken = ''
  userDataStore.profile = {}
  userDataStore.proposals = []
  router.push({name: 'Registration'})
}
</script>

<template>
  <div class="user-menu">
    <v-menu>
      <template #activator="{ props }">
        <v-btn
          variant="text"
          class="nav-text"
          :text="userDataStore.username"
          v-bind="props"
          append-icon="mdi-chevron-down"
        />
      </template>
      <v-card
        color="var(--card-background)"
        class="nav-text"
      >
        <v-list-item>
          <v-btn
            variant="text"
            text="Logout"
            @click="logOut"
          />
        </v-list-item>
      </v-card>
    </v-menu>
  </div>
</template>
<style scoped>
  .nav-text {
  color: var(--text);
  }
</style>
