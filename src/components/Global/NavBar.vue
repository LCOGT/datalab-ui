<script setup>
import { RouterLink } from 'vue-router'
import UserMenu from './UserMenu.vue'
import ptrlogo from '../../assets/ptr_logo.png'


document.addEventListener('DOMContentLoaded', () => {
  // Get all "navbar-burger" elements
  const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0)

  // Add a click event on each of them
  $navbarBurgers.forEach( el => {
    el.addEventListener('click', () => {

      // Get the target from the "data-target" attribute
      const target = el.dataset.target
      const $target = document.getElementById(target)

      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      el.classList.toggle('is-active')
      $target.classList.toggle('is-active')
    })
  })
})

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


