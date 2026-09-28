function pad(value, length) {
  return String(value).padStart(length, '0')
}

function formatSeconds(value, decimals) {
  return value.toFixed(decimals).padStart(3 + decimals, '0')
}

function decimalToSexagesimal(value, unitSize, signPrefix, degreeSymbol, secondDecimals) {
  const sign = value < 0 ? '-' : signPrefix
  const totalSeconds = Math.abs(value / unitSize) * 3600
  const units = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds - units * 3600) / 60)
  const seconds = totalSeconds - units * 3600 - minutes * 60

  return `${sign}${pad(units, 2)}${degreeSymbol}${pad(minutes, 2)}m${formatSeconds(seconds, secondDecimals)}s`
}

function sexagesimalToDecimal(value, unitSize) {
  const text = String(value).trim()
  const sign = text.startsWith('-') ? -1 : 1
  const parts = text
    .replace(/[hHdD°'"]/g, ' ')
    .replace(/[mMsS:]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number)
  return sign * (Math.abs(parts[0]) + parts[1] / 60 + parts[2] / 3600) * unitSize
}

export function raDegreesToSexagesimal(raDegrees) {
  return decimalToSexagesimal(raDegrees, 15, '', 'h', 3)
}

export function decDegreesToSexagesimal(decDegrees) {
  return decimalToSexagesimal(decDegrees, 1, decDegrees >= 0 ? '+' : '', '°', 2)
    .replace('m', '\'')
    .replace('s', '"')
}

export function raSexagesimalToDegrees(value) {
  return sexagesimalToDecimal(value, 15)
}

export function decSexagesimalToDegrees(value) {
  return sexagesimalToDecimal(value, 1)
}

export function coordinateInputToDegrees(value, sexagesimalConverter) {
  const text = String(value).trim()
  if (/^[+-]?\d+(?:[.]\d+)?\s*(?:degrees|deg|°|d)$/i.test(text)) {
    return Number(text.replace(/(?:degrees|deg|°|d)/i, '').trim())
  }
  return /[:hHdD°'"\s]/.test(text) ? sexagesimalConverter(text) : Number(text)
}
