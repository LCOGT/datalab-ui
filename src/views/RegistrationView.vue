<script setup>
import { ref, onBeforeMount } from 'vue'
import { useConfigurationStore } from '@/stores/configuration'
import { useUserDataStore } from '@/stores/userData'
import { useAlertsStore } from '@/stores/alerts'
import { useRouter } from 'vue-router'
import { fetchApiCall } from '@/utils/api'
import lambdaLogo from '../assets/PTR-lambda.png'

const configurationStore = useConfigurationStore()
const alertStore = useAlertsStore()
const userDataStore = useUserDataStore()
const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)

onBeforeMount(() => {
  if (userDataStore.userIsAuthenticated) router.push({ name: 'ProjectView' })
})

// validation rule for vuetify components
// we can add rules here in the future for passwords
const rules = {
  required: value => !!value || 'Required.'
}

const storeToken = async (data) => {
  const authToken = data.token
  if (authToken) {
    userDataStore.authToken = authToken
    await fetchApiCall({ url: configurationStore.observationPortalUrl + 'profile/', method: 'GET', successCallback: storeUser, failCallback: handleAuthError })
  }
}

const handleAuthError = (error) => {
  console.error('API call failed with error:', error)
  alertStore.setAlert('error', 'Credentials not recognized')
}

const storeUser = (user) => {
  userDataStore.username = username.value
  userDataStore.profile = user
  userDataStore.storeProposals(user.proposals)
  router.push({ name: 'ProjectView' })
}

const Login = async () => {
  const requestBody = {
    username: username.value,
    password: password.value
  }
  // store an auth token from login credentials
  await fetchApiCall({ url: configurationStore.observationPortalUrl + 'api-token-auth/', method: 'POST', body: requestBody, successCallback: storeToken, failCallback: handleAuthError })
}

</script>

<template>
  <v-container class="registration-container">
    <v-card
      color="var(--metal)"
      class="login-card pa-10"
    >
      <div class="login-title">
        <img
          class="lambdaLogo"
          :src="lambdaLogo"
        >
        <h1>Datalab</h1>
      </div>
      <v-form
        class="pt-7"
        @submit.prevent="Login"
      >
        <v-text-field
          v-model="username"
          autocomplete="username"
          label="Username"
          :rules="[rules.required]"
          required
        />

        <v-text-field
          v-model="password"
          autocomplete="current-password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
          :rules="[rules.required]"
          required
          @click:append="showPassword = !showPassword"
        />
        <v-btn
          type="submit"
          color="primary"
        >
          Login
        </v-btn>
      </v-form>
    </v-card>
  </v-container>
</template>

<style scoped>
.registration-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;

}

.login-card {
  width: 500px;
}

.lambdaLogo {
  height: 1.8em;
  margin-right: 10px;
}

.login-title {
  display: flex;
  align-items: center;
}
</style>
