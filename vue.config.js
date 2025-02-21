const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,

  pluginOptions: {
    vuetify: {
      // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
    },
    css: {
      loaderOptions: {
        scss: {
        additionalData: `@import '~bulma';`
        }
      }
      },
    pages: {
    index: {
      // entry for the page
      entry: 'src/main.js',
      title: 'DataLab @ Photon Ranch',
    },
    }
  },
  devServer: {
    headers: {
      'Cross-Origin-Embedder-Policy':'require-corp',
      'Cross-Origin-Opener-Policy':'same-origin',
    },
  },

  chainWebpack: (config) => {
    config.plugin('define').tap((definitions) => {
      Object.assign(definitions[0], {
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
      })
      return definitions
    })
  }
})
