import { fetchApiCall } from '@/utils/api'
import { useConfigurationStore } from '@/stores/configuration'

const cacheOptions = { 'ignoreVary': true, 'ignoreMethod': true, 'ignoreSearch': true }


async function getAllCacheKeys(size) {
  const cacheName = size + 'Thumbnails'
  return caches.open(cacheName).then((cache) => {
    return cache.keys().then((keys) => {
      return keys
    })
  })
}

async function getImageFromBasename(size, archive, url, imageBasename) {
  // Clean up the -large or -small on the basename from ptr archive images
  imageBasename = imageBasename.replace('-small', '').replace('-large', '')
  const cacheName = size + 'Thumbnails'
  return caches.open(cacheName).then((cache) => {
    return cache.match(imageBasename, cacheOptions).then(function (response) {
      // If not found in cache, then fetch image thumbnail from url or from archive and cache the result and return it
      return response || cacheImageFromBasename(size, archive, url, imageBasename)
    })
  })
}

async function deleteCachedImageFromBasename(size, imageBasename) {
  const cacheName = size + 'Thumbnails'
  return caches.open(cacheName).then((cache) => {
    return cache.delete(imageBasename, cacheOptions)
  })
}

async function cacheImageFromUrl(size, url, imageBasename) {
  const imageResponse = await fetch(url, { method: 'GET', mode: 'cors' })
  const cacheName = size + 'Thumbnails'
  caches.open(cacheName).then((cache) => {
    cache.put(imageBasename, imageResponse.clone())
  })
  return imageResponse.clone()
}

async function cacheImageFromBasename(size, archive, url, imageBasename) {
  // Right now we only have a ptr archive, but planning to maybe use this to differentiate later
  // If url exists, it will use that to directly download and cache image. If not it will use
  // the archive to decide how to fetch the image based on its basename and archive.
  if (url) {
    return cacheImageFromUrl(size, url, imageBasename)
  }
  else {
    const store = useConfigurationStore()
    if (archive == 'ptr') {
      const thumbnailBasename = imageBasename + '-' + size
      const frameUrl = store.datalabArchiveApiUrl + 'frames/?basename_exact=' + thumbnailBasename
      const responseData = await fetchApiCall({ url: frameUrl, method: 'GET', mode: 'cors' })
      if (responseData && responseData.results) {
        url = responseData.results[0].url
      }
    }
    else if (archive == 'lco') {
      // Use the lco thumbnail service to get the image thumbnail given its basename
      var width = 200
      if (size == 'large') {
        width = 1000
      }
      // Thumbnail service needs to set width and height or sometimes it creates a smaller thumbnail then requested
      const thumbnailServiceUrl = store.thumbnailServiceUrl + imageBasename + '/?width=' + width + '&height=' + width
      const responseData = await fetchApiCall({ url: thumbnailServiceUrl, method: 'GET'})
      if (responseData && responseData.url) {
        url = responseData.url
      }
    }
    if (!url) {
      console.error('Failed to get frame data for image ' + imageBasename)
    }
    else {
      return cacheImageFromUrl(size, url, imageBasename)
    }
  }
}

export { getImageFromBasename, deleteCachedImageFromBasename, getAllCacheKeys }
