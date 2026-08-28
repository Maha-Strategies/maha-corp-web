export const FULL_CIRCLE_MICRODEGREES = BigInt("360000000");
export const SIGN_MICRODEGREES = BigInt("30000000");
const I64_MIN = BigInt("-9223372036854775808");
const I64_MAX = BigInt("9223372036854775807");
export function checkedI64(value) {
    if (value < I64_MIN || value > I64_MAX)
        throw new RangeError('signed i64 overflow');
    return value;
}
export function normalizeAngleMicrodegrees(value) {
    const remainder = value % FULL_CIRCLE_MICRODEGREES;
    return remainder < BigInt("0") ? remainder + FULL_CIRCLE_MICRODEGREES : remainder;
}
export function divideHalfEven(numerator, denominator) {
    if (denominator === BigInt("0"))
        throw new RangeError('denominator must not be zero');
    const negative = (numerator < BigInt("0")) !== (denominator < BigInt("0"));
    const n = numerator < BigInt("0") ? -numerator : numerator;
    const d = denominator < BigInt("0") ? -denominator : denominator;
    const quotient = n / d;
    const remainder = n % d;
    const comparison = remainder - (d - remainder);
    const rounded = comparison > BigInt("0") || (comparison === BigInt("0") && (quotient & BigInt("1")) === BigInt("1")) ? quotient + BigInt("1") : quotient;
    return negative ? -rounded : rounded;
}
export function convertScaled(value, numerator, denominator) {
    return divideHalfEven(checkedI64(value * numerator), denominator);
}
export function integerSqrt(value) {
    if (value < BigInt("0"))
        throw new RangeError('square root input must be non-negative');
    if (value < BigInt("2"))
        return value;
    let x = value;
    let y = (x + BigInt("1")) / BigInt("2");
    while (y < x) {
        x = y;
        y = (x + value / x) / BigInt("2");
    }
    return x;
}
export const rootSumSquaresFloor = (a, b) => integerSqrt(checkedI64(checkedI64(a * a) + checkedI64(b * b)));
export const intervalAddLower = (a, b) => checkedI64(a + b);
export const intervalAddUpper = (a, b) => checkedI64(a + b);
export function angularSeparationMicrodegrees(a, b) {
    const delta = (() => { const d = normalizeAngleMicrodegrees(a) - normalizeAngleMicrodegrees(b); return d < BigInt("0") ? -d : d; })();
    return delta <= FULL_CIRCLE_MICRODEGREES - delta ? delta : FULL_CIRCLE_MICRODEGREES - delta;
}
export const zodiacSignIndex = (angle) => normalizeAngleMicrodegrees(angle) / SIGN_MICRODEGREES;
export function zodiacBoundaryDistanceMicrodegrees(angle) {
    const remainder = normalizeAngleMicrodegrees(angle) % SIGN_MICRODEGREES;
    return remainder <= SIGN_MICRODEGREES - remainder ? remainder : SIGN_MICRODEGREES - remainder;
}
export function layerThermalResistanceNanoKelvinPerWatt(thickness, area, conductivity) {
    if (thickness < BigInt("0") || area <= BigInt("0") || conductivity <= BigInt("0"))
        throw new RangeError('thermal inputs are outside the declared domain');
    return divideHalfEven(checkedI64(thickness * BigInt("1000000000000000")), checkedI64(area * conductivity));
}
export function temperatureRiseMicrokelvin(heatMilliwatts, resistanceNanoKelvinPerWatt) {
    if (heatMilliwatts < BigInt("0") || resistanceNanoKelvinPerWatt < BigInt("0"))
        throw new RangeError('thermal inputs are outside the declared domain');
    return divideHalfEven(checkedI64(heatMilliwatts * resistanceNanoKelvinPerWatt), BigInt("1000000"));
}
//# sourceMappingURL=reference.js.map