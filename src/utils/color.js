
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

const telescope_colors = {
  '0.4m': '--blue',
  '1m': '--orange',
  '2m': '--green',
  '4m': '--red',
}

const telescope_labels = [
  { key: '0.4m', label: '0.4m Telescope' },
  { key: '1m', label: '1m Telescope' },
  { key: '2m', label: '2m Telescope' },
  { key: '4m', label: '4m Telescope' }
]

export { rgbFilterMap, filterToColor, colorToFilter , colorRGBMap, rgbObjectToString, telescope_colors, telescope_labels }
