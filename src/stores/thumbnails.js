import { defineStore } from 'pinia'
import { LRUCache } from 'lru-cache'
import { deleteCachedImageFromBasename, getImageFromBasename, getAllCacheKeys } from '@/utils/imageLoader'
import { useConfigurationStore } from './configuration'


const cacheOptionsSmall = {
  max: 5000,
  dispose: (value, key, reason) => {
    if (reason != 'set'){
      deleteCachedImageFromBasename('small', key)
    }
  },
  noUpdateTTL: true,
  // cache files for one week
  ttl: 1000 * 60 * 60 * 24 * 7,
  ttlResolution: 100*60*60,
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
}

const cacheOptionsLarge = {
  max: 1000,
  dispose: (value, key, reason) => {
    if (reason != 'set'){
      deleteCachedImageFromBasename('large', key)
    }
  },
  noUpdateTTL: true,
  // cache files for one week
  ttl: 1000 * 60 * 60 * 24 * 7,
  ttlResolution: 100*60*60,
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
}

export const useThumbnailsStore = defineStore('thumbnails', {
  state() {
    return {
      archives: [],
      smallThumbnailsCache: new LRUCache(cacheOptionsSmall),
      largeThumbnailsCache: new LRUCache(cacheOptionsLarge),
    }
  },
  persist: {
    key: 'thumbnails',
    serializer: {
      serialize: value => {
        let serializedValue = {
          archives: value.archives,
          smallThumbnailsCache: value.smallThumbnailsCache.dump(),
          largeThumbnailsCache: value.largeThumbnailsCache.dump()
        }
        return JSON.stringify(serializedValue)
      },
      deserialize: value => {
        // De-serialize the image LRU cache from persistent storage, and invalid its stored URLs.
        let tempValue = JSON.parse(value)
        var smallThumbnailsCache2 = new LRUCache(cacheOptionsSmall)
        smallThumbnailsCache2.load(tempValue.smallThumbnailsCache)
        // Clear existing keys URL since they will be invalid on reload
        for (const key of [...smallThumbnailsCache2.keys()]) {
          const value = smallThumbnailsCache2.peek(key)
          URL.revokeObjectURL(value)
          smallThumbnailsCache2.set(key, '')
        }
        tempValue.smallThumbnailsCache = smallThumbnailsCache2
        var largeThumbnailsCache2 = new LRUCache(cacheOptionsLarge)
        largeThumbnailsCache2.load(tempValue.largeThumbnailsCache)
        // Clear existing keys URL since they will be invalid on reload
        for (const key of [...largeThumbnailsCache2.keys()]) {
          const value = largeThumbnailsCache2.peek(key)
          URL.revokeObjectURL(value)
          largeThumbnailsCache2.set(key, '')
        }
        tempValue.largeThumbnailsCache = largeThumbnailsCache2
        return (tempValue)
      },
    },
    afterRestore: async (ctx) => {
      // Rebuild the object urls here since they were cleared on reload
      await ctx.store.reloadCachedImagesIntoLRUCache()
    }
  },
  getters: {
    imageIsInCache: (state) => (size, basename) => {
      basename = basename.replace('-small', '').replace('-large', '')
      if (size == 'large') {
        return state.largeThumbnailsCache.has(basename)
      }
      else {
        return state.smallThumbnailsCache.has(basename)
      }
    },
    cachedUrl: (state) => (size, basename) => {
      basename = basename.replace('-small', '').replace('-large', '')
      if (size == 'large') {
        return state.largeThumbnailsCache.get(basename)
      }
      else {
        return state.smallThumbnailsCache.get(basename)
      }
    }
  },
  actions: {
    setArchives(archives) {
      this.archives = archives
    },
    async cacheImage(size, archive, url, basename, persist=true) {
      basename = basename.replace('-small', '').replace('-large', '')
      let cachedUrl = this.cachedUrl(size, basename)
      if (cachedUrl === undefined || cachedUrl === ''){
        return getImageFromBasename(size, archive, url, basename).then((response) => {
          if (response){
            return response.blob()
          }
          return undefined
        })
          .then((responseBlob) => {
            if (responseBlob) {
              // Convert to image/jpeg for caching as S3 presigned URLs blobs default to binary/octet-stream
              responseBlob = new Blob([responseBlob], {type: 'image/jpeg'})
              const responseUrl = URL.createObjectURL(responseBlob)
              if (size == 'large'){
                this.largeThumbnailsCache.set(basename, responseUrl)
                if (persist) this.$persist()  // must persist manually since it doesn't detect the cache changed
              }
              else {
                this.smallThumbnailsCache.set(basename, responseUrl)
                if (persist) this.$persist()  // must persist manually since it doesn't detect the cache changed
              }
              return responseUrl
            }
            return ''
          })
      }
      return cachedUrl
    },
    // This should just be called a single time when cache is reloaded fill the LRU cache with what is in the browser cache
    async reloadCachedImagesIntoLRUCache() {
      const configurationStore = useConfigurationStore()
      // This takes all the keys in the browser cache, and adds them to the LRU cache. If they were already in the cache, this
      // operation won't overwrite their TTL or order so they should keep their position and lifetime but regenerate their URL.
      var smallImageBasenames = await getAllCacheKeys('small')
      for (const key of smallImageBasenames) {
        let basename = key.url.split('/').pop()
        await this.cacheImage('small', configurationStore.archiveType, '', basename, false)
      }
      var largeImageBasenames = await getAllCacheKeys('large')
      for (const key of largeImageBasenames){
        let basename = key.url.split('/').pop()
        await this.cacheImage('large', configurationStore.archiveType, '', basename, false)
      }
    }
  },
})
