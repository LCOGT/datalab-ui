
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

const rgbObjectToString = (rgb) => {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`
}

const colorRGBMap = {
  'red': { r: 255, g: 0, b: 0 },
  'green': { r: 0, g: 255, b: 0 },
  'blue': { r: 0, g: 0, b: 255 },
}

export { rgbFilterMap, filterToColor, colorToFilter , colorRGBMap, rgbObjectToString }
