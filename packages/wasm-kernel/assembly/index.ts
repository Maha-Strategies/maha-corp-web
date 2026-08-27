const FULL_CIRCLE_MICRODEGREES: i64 = 360_000_000

export function normalizeAngleMicrodegrees(value: i64): i64 {
  const remainder = value % FULL_CIRCLE_MICRODEGREES
  return remainder < 0 ? remainder + FULL_CIRCLE_MICRODEGREES : remainder
}

export function divideHalfEven(numerator: i64, denominator: i64): i64 {
  if (denominator == 0) unreachable()
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
  return divideHalfEven(value * numerator, denominator)
}

export function intervalAddLower(aLower: i64, bLower: i64): i64 { return aLower + bLower }
export function intervalAddUpper(aUpper: i64, bUpper: i64): i64 { return aUpper + bUpper }

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
  return integerSqrt(a * a + b * b)
}
