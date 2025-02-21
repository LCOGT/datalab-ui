<script setup>
import { RouterLink } from 'vue-router'
import UserMenu from './UserMenu.vue'
import ptrlogo from '../../assets/ptr_logo.png'


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
      <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>
    <div class="navbar-menu">
      <div class="navbar-start">
        <div class="dropdown is-hoverable">
          <div class="dropdown-trigger">
            <button class="button datalab-site-menu is-normal" aria-haspopup="true" aria-controls="ptr-site-menu">
              <span>DataLab</span>
              <span class="icon is-small">
                <v-icon icon="mdi-menu-down"></v-icon>
              </span>
            </button>
          </div>
          <div id="ptr-site-menu" class="dropdown-menu"  role="menu">
            <div class="dropdown-content">
              <a href="#" class="dropdown-item"> Learn </a>
              <a href="#" class="dropdown-item"> Observe </a>
            </div>
          </div>
        </div>
      </div>
      <div class="navbar-end">
          <router-link to="/projects" class="navbar-item">Projects</router-link>
          <router-link to="/datasessions" class="navbar-item">Data Sessions</router-link>
        <div class="buttons">
          <user-menu />
        </div>
      </div>
    </div>
  </nav>
</template>
<style scoped>
  .nav-text {
  color: var(--tan);
  font-weight: 600;
  font-size: 1rem;
  }
  .active-tab {
    background-color: var(--dark-blue);
  }
  img.logo {
    width:auto;
    height:100%;
  }
  .datalab-site-menu {
    color: #fff;
    background-color: $red;
    font-weight: 600;
    font-size: 1rem;
  }
</style>
