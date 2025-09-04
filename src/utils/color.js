
const rgbFilterMap = {
  'red': ['r', 'rp', 'ip', 'h-alpha'],
  'green': ['v', 'gp', 'oiii'],
  'blue': ['b', 'sii'],
}

const filterToColor = (filter) => {
  filter = filter.trim().toLowerCase() || ''
  for (const [color, filters] of Object.entries(rgbFilterMap)) {
    if (filters.includes(filter)) {
      return color
    }
  }
  return 'var(--info)'
}

const colorToFilter = (color) => {
  color = color.trim().toLowerCase() || ''
  return rgbFilterMap[color] || []
}

const colorRGBMap = {
  'red': [255, 0, 0],
  'green': [0, 255, 0],
  'blue': [0, 0, 255],
}

export { rgbFilterMap, filterToColor, colorToFilter , colorRGBMap }
