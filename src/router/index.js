import { createRouter, createWebHistory } from 'vue-router'
import { useUserDataStore } from '@/stores/userData'
import DataSessions from '../views/DataSessionsView.vue'
import ProjectView from '../views/ProjectView.vue'
import Registration from '../views/RegistrationView.vue'

const routes = [
  {
    path: '/',
    name: 'Registration',
    component: Registration
  },
  {
    path: '/projects:startDate?:endDate?:observationId?:ra?:dec?:search?:proposalId?',
    name: 'ProjectView',
    component: ProjectView,
    beforeEnter: requireAuth,
  },
  {
    path: '/datasessions',
    name: 'DataSessionView',
    component: DataSessions,
    beforeEnter: requireAuth,
    props: true
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

function requireAuth(to, from, next){
  const userDataStore = useUserDataStore()
  !userDataStore.userIsAuthenticated ? next({ name: 'Registration' }) : next()
}

export default router
