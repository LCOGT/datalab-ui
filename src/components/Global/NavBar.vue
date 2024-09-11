<script setup>
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
  <v-toolbar
    rounded  >
    <v-img
      class="ms-6"
      max-height="30"
      max-width="30"
      min-width="30"
      contain
      src="../../assets/PTR-lambda.png"
    />
    <v-toolbar-title class="nav-text">
      DATALAB
    </v-toolbar-title>
    <v-tabs>
      <v-tab
        class="nav-text"
        to="/projects"
      >
        Projects
      </v-tab>
      <v-tab
        class="nav-text"
        to="/datasessions"
      >
        Data Sessions
      </v-tab>
    </v-tabs>
    <template #append>
      <user-menu />
    </template>
  </v-toolbar>
  <nav class="navbar" role="navigation" aria-label="main navigation">
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
        <!-- navbar items -->
      </div>
      <div class="navbar-end">
        <router-link class="navbar-item" to="/about">About</router-link>
        <router-link class="navbar-item" to="/learn">Learn</router-link>
        <router-link class="navbar-item" to="/observe">Observe</router-link>
        <router-link class="navbar-item" to="/datalab">DataLab</router-link>
        <div class="buttons">
          <user-menu />
        </div>
      </div>
    </div>
  </nav>
  <section class="hero">
      <div class="container">
        <div class="columns is-vcentered">
          <div class="column is-one-quarter">
            <h1>DataLab  <FontAwesomeIcon icon="fa-solid fa-chevron-right" class="blue small" /></h1>
          </div>
          <div class="column">
            <div class="tabs is-left">
              <ul>
                <li class="is-active"><router-link to="/projects">Projects</router-link></li>
                <li><router-link to="/datasessions">Data Sessions</router-link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
</template>


