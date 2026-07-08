const LIGHT_CURVE_FIELDS = {
  date: ['observation_date', 'date_obs'],
  magnitude: ['mag', 'target_calibrated_apparent_magnitude'],
  magnitudeError: ['magerr', 'target_calibrated_apparent_magnitude_uncertainty'],
}

function firstDefined(row, fields) {
  return fields.map(field => row?.[field]).find(value => value !== undefined && value !== null)
}

function firstNumber(row, fields) {
  const value = firstDefined(row, fields)
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeLightCurveRows(rows = []) {
  if (!Array.isArray(rows)) return []

  return rows
    .map(row => {
      const observationDate = firstDefined(row, LIGHT_CURVE_FIELDS.date)
      const mag = firstNumber(row, LIGHT_CURVE_FIELDS.magnitude)
      const magerr = firstNumber(row, LIGHT_CURVE_FIELDS.magnitudeError)

      return {
        ...row,
        observation_date: observationDate,
        mag,
        magerr,
      }
    })
    .filter(row => row.observation_date && row.mag !== null)
}

function lightCurveMagnitudes(rows = []) {
  return normalizeLightCurveRows(rows).map(({ mag }) => mag)
}

export { lightCurveMagnitudes, normalizeLightCurveRows }
