import { nextTick } from 'vue'
import L from 'leaflet'
import WCS from '@/utils/wcs'
import { loadImage, scalePoint } from '@/utils/common'

function useImageMap() {
  let wcs = null

  function createImageMap(container) {
    return L.map(container, {
      maxZoom: 5,
      minZoom: -3,
      zoomSnap: 0,
      zoomDelta: 0.5,
      crs: L.CRS.Simple,
      attributionControl: false,
      maxBoundsViscosity: 1.0,
    })
  }

  async function addImageOverlay(imageMap, imageUrl) {
    const image = await loadImage(imageUrl)
    const imageDimensions = { width: image.width, height: image.height }
    const imageBounds = [[0, 0], [imageDimensions.height, imageDimensions.width]]
    const imageOverlay = L.imageOverlay(imageUrl, imageBounds).addTo(imageMap)

    return { imageBounds, imageDimensions, imageOverlay }
  }

  function fitImageOverlay(imageMap, imageBounds) {
    nextTick(() => {
      imageMap.invalidateSize()
      imageMap.fitBounds(imageBounds)
      imageMap.setMaxBounds(imageBounds)
      imageMap.setMinZoom(imageMap.getZoom())
    })
  }

  function removeImageMap(imageMap) {
    imageMap.off()
    imageMap.remove()
  }

  function setWcsSolution(solution) {
    const { crval, crpix, cd1, cd2, fits_dimensions } = solution
    wcs = new WCS(
      crval[0],
      crval[1],
      crpix[0],
      crpix[1],
      cd1[0],
      cd1[1],
      cd2[0],
      cd2[1],
      fits_dimensions,
    )
  }

  function imagePointToRaDec(point, imageDimensions) {
    const pixel = scalePoint(
      imageDimensions.width,
      imageDimensions.height,
      wcs.fits_dimensions[0],
      wcs.fits_dimensions[1],
      point.lng,
      point.lat,
    )
    return wcs.pixelToRaDec(pixel.x, pixel.y)
  }

  function raDecToImagePoint(coordinate, imageDimensions) {
    const pixel = wcs.raDecToPixel(coordinate.ra, coordinate.dec)
    return scalePoint(
      wcs.fits_dimensions[0],
      wcs.fits_dimensions[1],
      imageDimensions.width,
      imageDimensions.height,
      pixel.x,
      pixel.y,
    )
  }

  return {
    addImageOverlay,
    createImageMap,
    fitImageOverlay,
    imagePointToRaDec,
    raDecToImagePoint,
    removeImageMap,
    setWcsSolution,
  }
}

export { useImageMap }
