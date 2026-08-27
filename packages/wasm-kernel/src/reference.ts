export const FULL_CIRCLE_MICRODEGREES = BigInt("360000000")

export function normalizeAngleMicrodegrees(value: bigint): bigint {
  const remainder = value % FULL_CIRCLE_MICRODEGREES
  return remainder < BigInt("0") ? remainder + FULL_CIRCLE_MICRODEGREES : remainder
}

export function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === BigInt("0")) throw new RangeError('denominator must not be zero')
  const negative = (numerator < BigInt("0")) !== (denominator < BigInt("0"))
  const n = numerator < BigInt("0") ? -numerator : numerator
  const d = denominator < BigInt("0") ? -denominator : denominator
  const quotient = n / d
  const remainder = n % d
  const comparison = remainder - (d - remainder)
  const rounded = comparison > BigInt("0") || (comparison === BigInt("0") && (quotient & BigInt("1")) === BigInt("1")) ? quotient + BigInt("1") : quotient
  return negative ? -rounded : rounded
}

export function convertScaled(value: bigint, numerator: bigint, denominator: bigint): bigint {
  return divideHalfEven(value * numerator, denominator)
}

export function integerSqrt(value: bigint): bigint {
  if (value < BigInt("0")) throw new RangeError('square root input must be non-negative')
  if (value < BigInt("2")) return value
  let x = value
  let y = (x + BigInt("1")) / BigInt("2")
  while (y < x) {
    x = y
    y = (x + value / x) / BigInt("2")
  }
  return x
}

export const rootSumSquaresFloor = (a: bigint, b: bigint): bigint => integerSqrt(a * a + b * b)
