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
          class="nav-text"
          :text="userDataStore.username"
          v-bind="props"
          append-icon="mdi-account-circle"
        />
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
      </v-card>
    </v-menu>
  </div>
</template>
<style scoped>
  .nav-text {
  color: var(--tan);
  font-weight: 600;
  font-size: 1rem;
  }
</style>
