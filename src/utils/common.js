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
  const filterColorMap = [
    { color: 'red', filters: ['r', 'rp', 'ip', 'h-alpha'] },
    { color: 'green', filters: ['v', 'oiii'] },
    { color: 'blue', filters: ['b', 'gp', 'sii'] },
  ]

  const lowerCaseFilter = filter.trim().toLowerCase()
  const found = filterColorMap.find(({ filters }) => filters.includes(lowerCaseFilter))
  return found ? found.color : 'var(--light-blue)'
}

function siteIDToName(siteID) {
  const siteIDMap = {
    'COJ': 'Siding Spring @ New South Wales',
    'CPT': 'South African Astronomical @ Cape Town',
    'TFN': 'Teide @ Tenerife',
    'LSC': 'Cerro Tololo Inter-American @ Chile',
    'ELP': 'McDonald @ University of Texas',
    'OGG': 'Haleakala @ Maui',
    'TLV': 'Wise @ Tel Aviv University',
    'NGQ': 'Ali @ Tibet',
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

export { calculateColumnSpan, siteIDToName, initializeDate, filterToPixelIndex, filterToColor }
