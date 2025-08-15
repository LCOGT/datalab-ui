import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedState from 'pinia-plugin-persistedstate'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'
import { vHide } from './directives/vHide'

import 'leaflet/dist/leaflet.css'
import './assets/css/ptr-extra.css'
import 'bulma/css/bulma.css'
import '@vue-flow/core/dist/style.css'
import 'vue-easy-dnd/dist/dnd.css'

loadFonts()

const pinia = createPinia()
pinia.use(piniaPluginPersistedState)

const app = createApp(App)

app.use(vuetify)
app.use(router)
app.use(pinia)

app.directive('hide', vHide)
  
app.mount('#app')
