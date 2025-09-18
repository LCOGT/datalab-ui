
class WCS {
  constructor(crval1, crval2, crpix1, crpix2, cd11, cd12, cd21, cd22, fits_dimensions) {
    this.crval1 = crval1
    this.crval2 = crval2
    this.crpix1 = crpix1
    this.crpix2 = crpix2
    this.cd11 = cd11
    this.cd12 = cd12
    this.cd21 = cd21
    this.cd22 = cd22
    this.fits_dimensions = fits_dimensions
    this.TINY_NUMBER = 1e-10
    this.DEG_TO_RAD = Math.PI / 180.0
  }

  degreesToRadians(deg) {
    return deg * this.DEG_TO_RAD
  }

  normalizeDegrees(deg){
    return ((deg % 360) + 360) % 360
  }

  raDecToPixel(ra, dec) {
    const cc = Math.cos(this.degreesToRadians(this.crval2))
    let det = this.cd11 * this.cd22 - this.cd21 * this.cd12

    if (Math.abs(det) < this.TINY_NUMBER || Math.abs(cc) < this.TINY_NUMBER) {
      throw new Error('Invalid WCS parameters')
    }

    det = det / cc
    const x = this.crpix1 + (this.cd22 * (ra - this.crval1) - this.cd12 * (dec - this.crval2) / cc) / det
    const y = this.crpix2 + (this.cd11 * (dec - this.crval2) - this.cd21 * (ra - this.crval1) / cc) / det
    return { x, y }
  }

  pixelToRa(x, y) {
    const cc = Math.cos(this.degreesToRadians(this.normalizeDegrees(this.crval2)))
    if (Math.abs(cc) < this.TINY_NUMBER) {
      throw new Error('Failed to convert pixel to RA: cos(crval2) is too small')
    }
    const ra = this.crval1 + ((x - this.crpix1) * this.cd11 + (y - this.crpix2) * this.cd12) / cc
    return ra
  }

  pixelToDec(x, y) {
    const dec = this.crval2 + (x - this.crpix1) * this.cd21 + (y - this.crpix2) * this.cd22
    return dec
  }

  pixelToRaDec(x, y) {
    const ra = this.pixelToRa(x, y)
    const dec = this.pixelToDec(x, y)
    return { ra, dec }
  }
}

export default WCS
