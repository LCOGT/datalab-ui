import { defineStore } from 'pinia'

/*
  This store manages user data and preferences.
  Persisted between reloads using pinia-plugin-persistedstate.
  It includes authentication details, user profile information, and UI preferences.
*/

export const useUserDataStore = defineStore('userData', {
  state() {
    return {
      username: '',
      authToken: '',
      profile: {},
      proposals: [],
      openProposals: [],
      gridToggle: true,
      coordsToggle: true,
      catalogToggle: true,
      activeSessionId: ''
    }
  },
  persist: true,
  getters: {
    userIsAuthenticated: (state) => {
      return state.authToken
    }
  },
  actions: {
    storeProposals(proposals) {
      // Takes a list of proposal objects with id, title, current props and organizes them alphabetically by current first
      this.proposals = proposals.toSorted()
      this.proposals.sort(function(a, b) {
        if (a.current === b.current) {
          return a.id < b.id ? -1 : 1
        }
        else {
          return a.current? -1: 1
        }
      })
      // Add a "Public Images" fake proposal to the end of everyones list
      this.proposals.push({
        current: true,
        id: 'public',
        title: 'Public Images'
      })
    },
  }
})
