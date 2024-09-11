const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
	transpileDependencies: true,

	pluginOptions: {
		vuetify: {
			// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
		}
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
})
