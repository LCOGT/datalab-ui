<script setup>
import { RouterLink } from 'vue-router'
import UserMenu from './UserMenu.vue'
import ptrlogo from '../../assets/ptr_logo.png'
import { ref } from 'vue'

const isMobileMenuOpen = ref(false)
const isActive = ref('')
const navBurger = ref('navbar-burger')
const navMenu = ref('navbar-menu')

function toggleMobileMenu () {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isActive.value === 'is-active') {
    isActive.value = ''
  } else {
    isActive.value = 'is-active'
  }
}

</script>

<template>
  <nav
    class="navbar"
    role="navigation"
    aria-label="main navigation"
  >
  <div class="navbar-brand">
      <router-link class="navbar-item" to="/">
        <img :src="ptrlogo" alt="Photon Ranch logo"/>
      </router-link>
      <a role="button" aria-label="menu" aria-expanded="false" :class="[isActive, navBurger]" @click="toggleMobileMenu">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>
    <div :class="[isActive, navMenu]">
      <div class="navbar-start">
        <div class="navbar-item has-dropdown is-hoverable">
            <a class="navbar-link datalab-site-menu">
              DataLab
            </a>
            <div class="navbar-dropdown">
              <a href="https://learn.lco.global" class="navbar-item learn-site-item" >
              <span>Learn</span>
              <span class="icon is-small">
                <v-icon icon="mdi-chevron-right" />
              </span></a>
              <a href="https://photonranch.lco.global" class="navbar-item observe-site-item">
              <span>Explore</span>
              <span class="icon is-small">
                <v-icon icon="mdi-chevron-right" />
              </span></a>
            </div>
          </div>
        </div>
      <div class="navbar-end">
        <router-link
          to="/projects"
          class="navbar-item"
        >
          Projects
        </router-link>
        <router-link
          to="/datasessions"
          class="navbar-item"
        >
          Data Sessions
        </router-link>
        <div class="buttons">
          <user-menu />
        </div>
      </div>
    </div>
  </nav>
</template>
<style scoped>
  .active-tab {
    background-color: var(--blue);
  }
  nav {
    background-color: var(--grey-level4);

    .navbar{
        min-height:2.75rem;
    }
    .datalab-site-menu{
      color: var(--grey-level3);
      font-size: 2em;
      background-color: var(--green);
      text-transform: uppercase;
      font-family: var(--font-headers);
    }
    .learn-site-item {
      color: var(--blue) !important;
      font-size: 1.25em;
      text-transform: uppercase;
      font-family: var(--font-headers);
    }
    .observe-site-item {
      color: var(--red) !important;
      font-size: 1.25em;
      text-transform: uppercase;
      font-family: var(--font-headers);
    }
    .router-link-active {
    background-color: var(--green);
    color: var(--grey-level3);
  }
  .navbar-link:not(.is-arrowless):after {
        border-color: var(--grey-level3);
        inset-inline-end: 1.125em;
        margin-top: -0.375em;
        font-size: 50%;
    }
}
</style>
