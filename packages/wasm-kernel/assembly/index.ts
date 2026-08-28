const FULL_CIRCLE_MICRODEGREES: i64 = 360_000_000
const SIGN_MICRODEGREES: i64 = 30_000_000
const NANO_PER_KELVIN: i64 = 1_000_000_000
const I64_MIN: i64 = -9_223_372_036_854_775_807 - 1

function checkedAdd(a: i64, b: i64): i64 {
  const result = a + b
  if ((b > 0 && result < a) || (b < 0 && result > a)) unreachable()
  return result
}

function checkedMultiply(a: i64, b: i64): i64 {
  if (a == 0 || b == 0) return 0
  const result = a * b
  if (result / a != b) unreachable()
  return result
}

export function normalizeAngleMicrodegrees(value: i64): i64 {
  const remainder = value % FULL_CIRCLE_MICRODEGREES
  return remainder < 0 ? remainder + FULL_CIRCLE_MICRODEGREES : remainder
}

export function divideHalfEven(numerator: i64, denominator: i64): i64 {
  if (denominator == 0) unreachable()
  if (numerator == I64_MIN || denominator == I64_MIN) unreachable()
  const negative = (numerator < 0) != (denominator < 0)
  const n = numerator < 0 ? -numerator : numerator
  const d = denominator < 0 ? -denominator : denominator
  const quotient = n / d
  const remainder = n % d
  const comparison = remainder - (d - remainder)
  const rounded = comparison > 0 || (comparison == 0 && (quotient & 1) == 1) ? quotient + 1 : quotient
  return negative ? -rounded : rounded
}

export function convertScaled(value: i64, numerator: i64, denominator: i64): i64 {
  if (denominator == 0) unreachable()
  return divideHalfEven(checkedMultiply(value, numerator), denominator)
}

export function intervalAddLower(aLower: i64, bLower: i64): i64 { return checkedAdd(aLower, bLower) }
export function intervalAddUpper(aUpper: i64, bUpper: i64): i64 { return checkedAdd(aUpper, bUpper) }

export function integerSqrt(value: i64): i64 {
  if (value < 0) unreachable()
  if (value < 2) return value
  let x = value
  let y = (x + 1) / 2
  while (y < x) {
    x = y
    y = (x + value / x) / 2
  }
  return x
}

export function rootSumSquaresFloor(a: i64, b: i64): i64 {
  return integerSqrt(checkedAdd(checkedMultiply(a, a), checkedMultiply(b, b)))
}

export function angularSeparationMicrodegrees(a: i64, b: i64): i64 {
  const left = normalizeAngleMicrodegrees(a)
  const right = normalizeAngleMicrodegrees(b)
  const delta = left > right ? left - right : right - left
  return delta <= FULL_CIRCLE_MICRODEGREES - delta ? delta : FULL_CIRCLE_MICRODEGREES - delta
}

export function zodiacSignIndex(angle: i64): i64 {
  return normalizeAngleMicrodegrees(angle) / SIGN_MICRODEGREES
}

export function zodiacBoundaryDistanceMicrodegrees(angle: i64): i64 {
  const remainder = normalizeAngleMicrodegrees(angle) % SIGN_MICRODEGREES
  return remainder <= SIGN_MICRODEGREES - remainder ? remainder : SIGN_MICRODEGREES - remainder
}

// R[K/W] = thickness[nm] * 10^6 / (conductivity[mW/mK] * area[um^2]).
// The exported value is nano-kelvin per watt, hence the 10^15 scale.
export function layerThermalResistanceNanoKelvinPerWatt(
  thicknessNanometers: i64,
  areaSquareMicrometers: i64,
  conductivityMilliwattsPerMeterKelvin: i64,
): i64 {
  if (thicknessNanometers < 0 || areaSquareMicrometers <= 0 || conductivityMilliwattsPerMeterKelvin <= 0) unreachable()
  const denominator = checkedMultiply(areaSquareMicrometers, conductivityMilliwattsPerMeterKelvin)
  const scaledThickness = checkedMultiply(thicknessNanometers, 1_000_000_000_000_000)
  return divideHalfEven(scaledThickness, denominator)
}

export function temperatureRiseMicrokelvin(
  heatMilliwatts: i64,
  resistanceNanoKelvinPerWatt: i64,
): i64 {
  if (heatMilliwatts < 0 || resistanceNanoKelvinPerWatt < 0) unreachable()
  return divideHalfEven(checkedMultiply(heatMilliwatts, resistanceNanoKelvinPerWatt), NANO_PER_KELVIN)
}
