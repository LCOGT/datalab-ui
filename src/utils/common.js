const calculateColumnSpan = (imageCount, imagesPerRow) => {
  const totalColumns = Math.floor(12 / Math.min(imagesPerRow, imageCount))
  return totalColumns
}

const convertFilter = (filter) => {
  if (filter === 'V' || filter === 'gp') {
    return 'g'
  }
  else if (filter === 'rp' || filter === 'r') {
    return 'r'
  }
  else if (filter === 'B') {
    return 'b'
  }
}

const filterToPixelIndex = (filter) => {
  if (filter === 'r') {
    return 0
  }
  else if (filter === 'g') {
    return 1
  }
  else if (filter === 'b') {
    return 2
  }
}

export { calculateColumnSpan, convertFilter, filterToPixelIndex }
