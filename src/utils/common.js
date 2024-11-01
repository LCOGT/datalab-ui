const calculateColumnSpan = (imageCount, imagesPerRow) => {
  const totalColumns = Math.floor(12 / Math.min(imagesPerRow, imageCount))
  return totalColumns
}

function siteIDToName(siteID) {
  const siteIDMap = {
    'COJ': 'Siding Spring Observatory @ New South Wales',
    'CPT': 'South African Astronomical Observatory @ Cape Town',
    'TFN': 'Teide Observatory @ Tenerife',
    'LSC': 'Cerro Tololo Inter-American Observatory @ Chile',
    'ELP': 'McDonald Observatory @ University of Texas',
    'OGG': 'Haleakala Observatory @ Maui',
    'TLV': 'Wise Observatory @ Tel Aviv University',
    'NGQ': 'Ali Observatory @ Tibet',
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

export { calculateColumnSpan, siteIDToName, initializeDate }
