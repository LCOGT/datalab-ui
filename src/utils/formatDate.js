const mjd_unix_epoch = 40587
const ms_per_day = 24 * 60 * 60 * 1000

function dateToMjd(date) {
  const time = new Date(date).getTime()
  return (time / ms_per_day) + mjd_unix_epoch
}

function formatMjd(value, mjd_decimal_places) {
  return Number(value).toFixed(mjd_decimal_places)
}

function formatDayOffset(value, day_offset_decimal_places) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(day_offset_decimal_places)} d`
}

export { dateToMjd, formatMjd, formatDayOffset }
