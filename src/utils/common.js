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

const filterToColor = (filter) => {
  filter = filter || ''
  const filterColorMap = [
    { color: 'red', filters: ['r', 'rp', 'ip', 'h-alpha'] },
    { color: 'green', filters: ['v', 'gp', 'oiii'] },
    { color: 'blue', filters: ['b', 'sii'] },
  ]

  const lowerCaseFilter = filter.trim().toLowerCase()
  const found = filterColorMap.find(({ filters }) => filters.includes(lowerCaseFilter))
  return found ? found.color : 'var(--info)'
}

function siteIDToName(siteID) {
  const siteIDMap = {
    'COJ': 'COJ @ Siding Spring',
    'CPT': 'CPT @ South Africa',
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

// Utility function to load an image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

export { calculateColumnSpan, siteIDToName, initializeDate, filterToPixelIndex, filterToColor, loadImage }
