import { defineStore } from 'pinia'


export const useUserDataStore = defineStore('userData', {
  state() {
    return {
      username: '',
      authToken: '',
      profile: {},
      proposals: [],
      openProposals: [],
      gridToggle: true,
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
    },
  }
})
