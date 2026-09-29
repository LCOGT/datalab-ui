<script setup>
import { RouterLink } from 'vue-router'
import UserMenu from './UserMenu.vue'
import ptrlogo from '../../assets/ptr_logo.png'
import { ref } from 'vue'

const isMobileMenuOpen = ref(false)

const navLinks = [
  { to: '/projects', label: 'Projects' },
  { to: '/datasessions', label: 'Data Sessions' },
]

function toggleMobileMenu () {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}
</script>

<template>
  <v-toolbar
    class="navbar"
    density="comfortable"
    role="navigation"
    aria-label="main navigation"
  >
    <router-link
      class="navbar-brand"
      to="/"
    >
      <img
        :src="ptrlogo"
        alt="Photon Ranch logo"
      >
    </router-link>

    <v-menu open-on-hover>
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          class="datalab-site-menu"
          append-icon="mdi-chevron-down"
          height="100%"
          rounded="0"
          variant="flat"
        >
          DataLab
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item
          class="learn-site-item"
          href="https://learn.lco.global"
          append-icon="mdi-chevron-right"
          title="Learn"
        />
        <v-list-item
          class="observe-site-item"
          href="https://explore.lco.global/"
          append-icon="mdi-chevron-right"
          title="Explore"
        />
      </v-list>
    </v-menu>

    <v-spacer />

    <div class="navbar-links">
      <router-link
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="navbar-item"
      >
        {{ link.label }}
      </router-link>
      <user-menu />
    </div>

    <v-app-bar-nav-icon
      class="navbar-burger"
      :icon="isMobileMenuOpen ? 'mdi-close' : 'mdi-menu'"
      aria-label="menu"
      :aria-expanded="isMobileMenuOpen"
      @click="toggleMobileMenu"
    />
  </v-toolbar>
  <div
    v-show="isMobileMenuOpen"
    class="navbar-mobile-menu"
  >
    <router-link
      v-for="link in navLinks"
      :key="link.to"
      :to="link.to"
      class="navbar-item"
      @click="isMobileMenuOpen = false"
    >
      {{ link.label }}
    </router-link>
    <user-menu />
  </div>
</template>

<style scoped>
.navbar {
  background-color: var(--grey-level4);
}

.navbar-brand {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
}

.navbar-brand img {
  max-height: 1.75rem;
}

.navbar-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  color: inherit;
  text-decoration: none;
  line-height: 1.5;
}

.datalab-site-menu {
  color: var(--grey-level3);
  font-size: 2em;
  background-color: var(--green);
  text-transform: uppercase;
  font-family: var(--font-headers);
}

.datalab-site-menu :deep(.v-icon) {
  font-size: 1.6rem;
}

.router-link-active {
  background-color: var(--green);
  color: var(--grey-level3);
}

.navbar-mobile-menu {
  display: none;
  flex-direction: column;
  align-items: stretch;
  padding: 0.5rem 0;
  background-color: var(--grey-level4);
  box-shadow: 0 0.5em 1em rgb(0 0 0 / 30%);
}

@media screen and (min-width: 1024px) {
  .navbar-burger {
    display: none;
  }

  .navbar-links {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}

@media screen and (max-width: 1023px) {
  .navbar-links {
    display: none;
  }

  .navbar-mobile-menu {
    display: flex;
  }
}
</style>

<style scoped>
.learn-site-item,
.observe-site-item {
  font-size: 1.25em;
  text-transform: uppercase;
  font-family: var(--font-headers);
}

.learn-site-item {
  color: var(--blue);
}

.observe-site-item {
  color: var(--red);
}
</style>
