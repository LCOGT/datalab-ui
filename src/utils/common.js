const calculateColumnSpan = (imageCount, imagesPerRow) => {
  const totalColumns = Math.floor(12 / Math.min(imagesPerRow, imageCount))
  return totalColumns
}

function filterToPixelIndex(filter) {
  const filterPixelMap = {
    'red': 0,
    'green': 1,
    'blue': 2,
  }

  return filterPixelMap[filter.trim().toLowerCase()]
}

function siteIDToName(siteID) {
  const siteIDMap = {
    'COJ': 'COJ @ Siding Spring',
    'CPT': 'CPT @ Cape Town',
    'TFN': 'TFN @ Teide',
    'LSC': 'LSC @ Cerro Tololo',
    'ELP': 'ELP @ McDonald',
    'OGG': 'OGG @ Haleakala',
    'TLV': 'TLV @ Wise',
    'NGQ': 'NGQ @ Ali',
  }

  return siteIDMap[siteID?.toUpperCase()] || siteID
}

function initializeDate(dateString = 'none', defaultOffsetDays = 0) {
  /**
   * Initialize a date object from a string
   * If the date string is invalid, the current date is used with an optional offset
   * @param {string} dateString - The date string to be converted
   * @param {number} defaultOffsetDays - The number of days to offset if the date string is invalid
   * @returns {Date} - The date object
   */
  const date = new Date(dateString)
  return isNaN(date.getTime()) ? new Date(Date.now() + defaultOffsetDays * 24 * 3600 * 1000) : date
}

function scalePoint(width1, height1, width2, height2, x, y){
  return {
    x: (x / width1) * width2,
    y: (y / height1) * height2
  }
}

// Utility function to load an image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

export { calculateColumnSpan, siteIDToName, initializeDate, filterToPixelIndex, loadImage, scalePoint }
